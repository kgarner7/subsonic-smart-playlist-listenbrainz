from typing import ClassVar, Dict, List, Literal, Optional, Type, Union

from enum import Enum as PyEnum

from dataclasses import field
from marshmallow_dataclass import dataclass
from marshmallow import Schema
from marshmallow.validate import Length


class base_schema:
    Schema: ClassVar[Type["Schema"]] = Schema


@dataclass
class CreatePlaylist(base_schema):
    id: Optional[Union[str, int]]
    ids: List[Union[str, int]] = field(
        metadata={"required": True, "validate": Length(1)},
    )
    name: Optional[str]


class Mode(str, PyEnum):
    EASY = "easy"
    MEDIUM = "medium"
    HARD = "hard"


class PromptType(str, PyEnum):
    PROMPT = "prompt"
    SESSION = "session"


@dataclass
class TextRadio(base_schema):
    type: Literal[PromptType.PROMPT]
    prompt: str
    mode: Mode = field(metadata={"by_value": True})


@dataclass
class SessionRadio(base_schema):
    type: Literal[PromptType.SESSION]
    id: int


@dataclass
class CreateRadio(base_schema):
    prompt: Union[TextRadio, SessionRadio]
    excluded_mbids: Optional[List[Union[str, int]]]
    quiet: Optional[bool]


@dataclass
class CreateRadioWithCredentials(base_schema):
    credentials: Dict[str, str]
    excluded_mbids: Optional[List[Union[str, int]]]
    prompt: Union[TextRadio, SessionRadio]
    quiet: Optional[bool]


@dataclass
class Login(base_schema):
    username: str
    password: str


@dataclass
class Scan(base_schema):
    full: bool


@dataclass
class CreateSession(base_schema):
    mbids: List[Union[str, int]] = field(
        metadata={"required": True, "validate": Length(1)},
    )
    mode: Mode = field(metadata={"by_value": True})
    name: str
    prompt: str
