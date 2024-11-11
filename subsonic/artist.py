from peewee import *
from troi.content_resolver.model.database import db
from troi.content_resolver.model.recording import Recording

__all__ = ["Artist", "RecordingArtist"]


class Artist(Model):
    """
    Basic metadata about an artist in Musicbrainz
    """

    class Meta:
        database = db
        table_name = "artist"

    mbid = TextField(primary_key=True)
    name = TextField(null=False)
    subsonic_name = TextField(null=True)
    subsonic_id = TextField(null=True)

    def __repr__(self) -> str:
        return f"<Artist('{self.mbid}', '{self.name}', '{self.subsonic_name}', '{self.subsonic_id}')>"


class RecordingArtist(Model):
    """
    Represents a Many-to-many association between recordings and artists
    """

    class Meta:
        database = db
        table_name = "recording_artist"

    recording = ForeignKeyField(Recording, on_delete="CASCADE")
    artist = ForeignKeyField(Artist, on_delete="CASCADE")

    def __repr__(self) -> str:
        return f"<RecordingArtist('{self.recording}', '{self.artist}')"
