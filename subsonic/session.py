from peewee import *
from playhouse.sqlite_ext import JSONField
from troi.content_resolver.model.database import db

__all__ = ["Session"]


class Session(Model):
    """
    A class representing a radio session. This includes the user, prompt
    and songs seen so far
    """

    class Meta:
        database = db
        table_name = "session"

    id = AutoField()
    username = TextField(null=False, index=True)
    name = TextField(null=False)
    prompt = TextField(null=False)
    mode = TextField(null=False)
    seen = JSONField(null=True)
    last_updated = DateTimeField()

    def __repr__(self) -> str:
        return f"<Session('{self.username}', '{self.prompt}', {self.seen.length()})"
