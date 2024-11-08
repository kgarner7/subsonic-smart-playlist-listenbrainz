from dotenv import load_dotenv

load_dotenv()

from functools import wraps
from json import dumps, loads
from os import environ
from subprocess import run

from flask import Flask, Response, render_template, request, session
from flask_session import Session

from subsonic.custom_connection import CustomConnection
from subsonic.database import ArtistSubsonicDatabase, get_metadata
from subsonic.process import MetadataHandler

CACHE_TYPE = environ.get("CACHE_TYPE", "filesystem")
PERMANENT_SESSION_LIFETIME = int(environ.get("SESSION_DURATION_SEC", 86400))
DEBUG = environ.get("MODE", "production") == "debug"

if CACHE_TYPE == "filesystem":
    from cachelib.file import FileSystemCache

    CACHE_PATH = environ.get("CACHE_PATH", "./session")

    SESSION_TYPE = "cachelib"
    SESSION_CACHELIB = FileSystemCache(CACHE_PATH)
else:
    from redis import Redis

    REDIS_URL = environ.get("REDIS_URL", "http://localhost:6379")
    SESSION_REDIS = Redis.from_url(REDIS_URL)

SESSION_COOKIE_SAMESITE = "Strict"


app = Flask(
    __name__, static_folder="ui/dist", static_url_path="", template_folder="ui/dist"
)
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
                return func(credentials, *args, **kwargs)
        except BaseException as e:
            print(e)
            return {"error": str(e)}, 401

        return {"error": "not authenticated"}, 401

    return is_authorized


@app.get("/")
def index():
    return render_template("index.html", authenticated="credentials" in session)


@app.post("/api/login")
def login():
    user = request.json.get("username")

    if user is None:
        return {"error": "username is required"}, 400

    password = request.json.get("password")
    if password is None:
        return {"error": "password is required"}, 400

    connection = CustomConnection(username=user, password=password)
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
def start_scan(_credentials):
    is_full = request.json.get("full", False)
    started = handler.submit_scan(is_full)
    return {"started": started}


@app.get("/api/scanStatus")
@login_or_credentials_required
def get_scan_status(_credentials):
    return handler.get_state_json()


@app.get("/api/tags")
@login_or_credentials_required
def get_tags(_credentials):
    return get_metadata(), 200


ALLOWED_MODES = {"easy", "medium", "hard"}


@app.post("/api/radio")
@login_or_credentials_required
def radio(credentials):
    mode = request.json.get("mode")
    if mode not in ALLOWED_MODES:
        return {"error": f"Bad mode {mode}. Must be one of: {ALLOWED_MODES}"}, 400

    prompt = request.json.get("prompt")
    if not prompt:
        return {"error": "Must provide a prompt"}, 400

    output = run(
        ["python3", "get_radio.py"],
        capture_output=True,
        input=dumps({"mode": mode, "prompt": prompt, "credentials": credentials}),
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
def create_playlist(credentials):
    name = request.json.get("name")
    ids = request.json.get("ids")

    if not name or not ids or not isinstance(ids, list):
        return {"error": "Must provide playlist name and ids"}, 400

    conn = CustomConnection(credentials=credentials)
    resp = conn.createPlaylist(name=name, songIds=ids)

    return {"id": resp["playlist"]["id"]}, 200


@app.delete("/api/logout")
@login_or_credentials_required
def logout(_credentials):
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


handler = MetadataHandler()

database = ArtistSubsonicDatabase()
database.create()
del database

if __name__ == "__main__":
    app.run()
