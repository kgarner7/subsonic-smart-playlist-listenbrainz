from dotenv import load_dotenv

load_dotenv()

from os import environ

from subsonic.database import (
    ArtistSubsonicDatabase,
    delete_session,
    get_metadata,
    get_sessions,
)
from subsonic.process import MetadataHandler

CACHE_TYPE = environ.get("CACHE_TYPE", "filesystem")
PERMANENT_SESSION_LIFETIME = int(environ.get("SESSION_DURATION_SEC", 86400))
DEBUG = environ.get("MODE", "production") == "debug"

SESSION_COOKIE_SAMESITE = "Strict"


def create_app():
    from functools import wraps
    from json import dumps, loads
    from subprocess import run

    from subsonic.custom_connection import CustomConnection
    import subsonic.schema as s

    from flask import Flask, Response, render_template, request, session
    from flask_session import Session
    from marshmallow import ValidationError

    app = Flask(
        __name__, static_folder="ui/dist", static_url_path="", template_folder="ui/dist"
    )
    global CACHE_PATH, SESSION_CACHELIB, SESSION_REDIS, SESSION_TYPE

    if CACHE_TYPE == "filesystem":
        from cachelib.file import FileSystemCache

        CACHE_PATH = environ.get("CACHE_PATH", "./session")

        SESSION_TYPE = "cachelib"
        SESSION_CACHELIB = FileSystemCache(CACHE_PATH)
    else:
        from redis import Redis

        REDIS_URL = environ.get("REDIS_URL", "http://localhost:6379")
        SESSION_REDIS = Redis.from_url(REDIS_URL)

    app.config.from_object(__name__)
    Session(app)

    def login_or_credentials_required(func):
        @wraps(func)
        def is_authorized(*args, **kwargs):
            if "credentials" in session:
                return func(session["credentials"], *args, **kwargs)

            user = request.args.get("u")

            if user is None:
                return {"error": "not authenticated"}, 401

            token = request.args.get("t")
            salt = request.args.get("s")

            if token and salt:
                credentials = {"u": user, "s": salt, "t": token}
            else:
                password = request.args.get("p")
                if password is None:
                    return {"error": "not authenticated"}, 401
                credentials = {"u": user, "p": password}

            conn = CustomConnection(credentials=credentials)
            try:
                ok = conn.ping()
                if ok:
                    return func(*args, **kwargs, credentials=credentials)
            except BaseException as e:
                print(e)
                return {"error": str(e)}, 401

            return {"error": "not authenticated"}, 401

        return is_authorized

    def validate_schema(schema: "s.Schema"):
        def decorator(func):
            @wraps(func)
            def validate(*args, **kwargs):
                json = schema().load(request.json)
                return func(*args, **kwargs, json=json)

            return validate

        return decorator

    @app.get("/")
    def index():
        return render_template("index.html", authenticated="credentials" in session)

    @app.post("/api/login")
    @validate_schema(s.Login)
    def login(json: dict):
        connection = CustomConnection(
            username=json["username"], password=json["password"]
        )
        try:
            ok = connection.ping()
            if ok:
                session["credentials"] = connection._credentials
                app.session_interface.regenerate(session)
                return {}

            return {"error": "Login failed"}, 401
        except BaseException as e:
            return {"error": str(e)}, 401

    @app.post("/api/scan")
    @login_or_credentials_required
    @validate_schema(s.Scan)
    def start_scan(_, json: "dict"):
        started = handler.submit_scan(json["full"])
        return {"started": started}

    @app.get("/api/scanStatus")
    @login_or_credentials_required
    def get_scan_status(_):
        return handler.get_state_json()

    @app.get("/api/playlists")
    @login_or_credentials_required
    def get_playlists(credentials):
        conn = CustomConnection(credentials=credentials)
        playlists = conn.getPlaylists()["playlists"]["playlist"]
        minified = [
            {
                "id": playlist["id"],
                "name": playlist["name"],
                "songs": playlist["songCount"],
                "duration": playlist["duration"],
            }
            for playlist in playlists
        ]
        return minified, 200

    @app.get("/api/session")
    @login_or_credentials_required
    def sessions(credentials):
        return get_sessions(credentials["u"]), 200

    @app.get("/api/tags")
    @login_or_credentials_required
    def tags(_):
        return get_metadata(), 200

    @app.post("/api/radio")
    @login_or_credentials_required
    @validate_schema(s.CreateRadio)
    def radio(credentials, json):
        output = run(
            ["python3", "get_radio.py"],
            capture_output=True,
            input=dumps({"credentials": credentials, "prompt": json["prompt"]}),
            text=True,
        )

        if output.returncode != 0:
            print(output.stderr)
            return {"error": "could not find recordings to make a playlist"}, 400
        else:
            data = loads(output.stdout.split("\n")[-1])

            if not data:
                print(output.stderr)
                return {"error": "could not find recordings to make a playlist"}, 400

            return [data, output.stderr]

    @app.get("/api/proxy/<id>")
    @login_or_credentials_required
    def proxy(credentials, id) -> "Response":
        conn = CustomConnection(credentials=credentials)
        resp = conn.getCoverArt(id, 150)
        return Response(
            resp,
            resp.status,
            content_type=resp.getheader("content-type"),
        )

    @app.post("/api/createPlaylist")
    @login_or_credentials_required
    @validate_schema(s.CreatePlaylist)
    def create_playlist(credentials, json: "dict"):
        conn = CustomConnection(credentials=credentials)
        if "id" in json == "name" in json:
            return {"error": "You must provide EITHER playlist name OR id"}, 400

        print(json)
        resp = conn.createPlaylist(
            name=json.get("name"), playlistId=json.get("id"), songIds=json["ids"]
        )

        return {"id": resp["playlist"]["id"]}, 200

    @app.delete("/api/deleteSession/<int:id>")
    @login_or_credentials_required
    def destroy_session(credentials, id):
        try:
            delete_session(credentials["u"], id)
            return {}, 200
        except BaseException as e:
            print(e)
            return {"error": "Could not"}, 400

    @app.delete("/api/logout")
    @login_or_credentials_required
    def logout(_):
        session.clear()
        return {}, 200

    @app.after_request
    def add_headers(response):
        response.headers["Content-Security-Policy"] = (
            "default-src 'self';"
            "font-src 'self';"
            "form-action 'self';"
            "frame-ancestors 'self';"
            "frame-src 'none';"
            "img-src *;"
            "script-src 'self' 'unsafe-inline';"
            "style-src 'self' 'unsafe-inline';"
            "object-src 'none'"
        )
        response.headers["Permissions-Policy"] = "browsing-topics=()"
        return response

    @app.errorhandler(ValidationError)
    def handle_validation_error(e: "ValidationError"):
        messages = [f"{field}: {error}" for field, error in e.messages.items()]

        return {"error": "\n".join(messages)}, 400

    return app


handler = MetadataHandler()

database = ArtistSubsonicDatabase()
database.create()
del database

if __name__ == "__main__":
    if DEBUG:
        app = create_app()
        app.run()
    else:
        from gunicorn.app.base import Application

        class GunicornApp(Application):
            def __init__(self):
                super().__init__()

            def init(self, _parser, _opts, _args):
                pass

            def load(self):
                return create_app()

        g = GunicornApp()
        g.run()
