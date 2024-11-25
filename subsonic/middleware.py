from functools import wraps

from flask import request, session
from troi.content_resolver.database import db
from troi.content_resolver.model.database import setup_db


from .custom_connection import CustomConnection
from .database import DATABASE_PATH
from .schema import *


def get_database(func):
    @wraps(func)
    def database_wrapper(*args, **kwargs):
        try:
            setup_db(DATABASE_PATH)
            db.connect()
            return func(*args, **kwargs)
        finally:
            db.close()

    return database_wrapper


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


def validate_schema(schema: "base_schema"):
    def decorator(func):
        @wraps(func)
        def validate(*args, **kwargs):
            json = schema.Schema().load(request.json)
            return func(*args, **kwargs, json=json)

        return validate

    return decorator
