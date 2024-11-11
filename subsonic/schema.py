from typing import Any, Mapping

from enum import Enum as PyEnum

from marshmallow import ValidationError, Schema
from marshmallow.fields import (
    Boolean,
    Constant,
    Dict,
    Enum,
    Field,
    Integer,
    List,
    String,
)
from marshmallow.utils import EXCLUDE
from marshmallow.validate import Length


class IntOrString(Field):
    def _deserialize(
        self, value: Any, attr: str | None, data: Mapping[str, Any] | None, **kwargs
    ):
        if isinstance(value, str):
            return value
        elif isinstance(value, int):
            return str(value)
        else:
            raise ValidationError("Must be either a string or int")


class CreatePlaylist(Schema):
    name = String(required=True)
    ids = List(IntOrString, required=True, validate=Length(min=1))


class Mode(str, PyEnum):
    EASY = "easy"
    MEDIUM = "medium"
    HARD = "hard"


class PromptType(str, PyEnum):
    PROMPT = "prompt"
    SESSION = "session"


class Prompt(Schema):
    mode = Enum(Mode, by_value=True, required=True)
    prompt = String(required=True)
    session = Boolean(truthy=set(), falsy=set())
    type = Constant(PromptType.PROMPT)


class Session(Schema):
    id = Integer(required=True)
    type = Constant(PromptType.SESSION)


class PromptOrSession(Field):
    def _deserialize(
        self, value: Any, attr: str | None, data: Mapping[str, Any] | None, **kwargs
    ):
        if not isinstance(value, dict):
            raise ValidationError("Must be a dictionary")

        type = value.get("type")
        if type == PromptType.PROMPT.value:
            return Prompt().load(value, unknown=EXCLUDE)
        elif type == PromptType.SESSION.value:
            return Session().load(value, unknown=EXCLUDE)
        else:
            raise ValidationError("Prompt type must be either 'prompt' or 'session'")


class CreateRadio(Schema):
    prompt = PromptOrSession(required=True)


class CreateRadioWithCredentials(Schema):
    credentials = Dict(String(), String(), required=True)
    prompt = PromptOrSession(required=True)
    quiet = Boolean(truthy=set(), falsy=set())


class Login(Schema):
    username = String(required=True)
    password = String(required=True)


class Scan(Schema):
    full = Boolean(truthy=set(), falsy=set())
