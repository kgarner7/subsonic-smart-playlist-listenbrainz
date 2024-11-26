from os import environ

from troi.content_resolver.database import db
from troi.content_resolver.subsonic import SubsonicDatabase

from .artist import Artist, RecordingArtist
from .rating import create_rating_table
from .session import Session

DATABASE_PATH = environ["DATABASE_PATH"]


__all__ = ["ArtistSubsonicDatabase", "get_metadata"]


class ArtistSubsonicDatabase(SubsonicDatabase):
    def __init__(self):
        super().__init__(DATABASE_PATH, None, True)

    def create(self):
        super().create()
        # Additional tables we want to keep track of resolved artists
        db.create_tables((Artist, RecordingArtist, Session))
        create_rating_table(db)
