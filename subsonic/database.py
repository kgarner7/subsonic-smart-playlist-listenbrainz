from typing import List, Optional, TypedDict

from os import environ

from troi.content_resolver.database import db
from troi.content_resolver.subsonic import SubsonicDatabase
from troi.content_resolver.model.database import setup_db

from .artist import Artist, RecordingArtist
from .custom_connection import CustomConnection
from .session import Session

SUBSONIC_BACKEND_USER = environ["SUBSONIC_BACKEND_USER"]
SUBSONIC_BACKEND_PASS = environ["SUBSONIC_BACKEND_PASS"]
DATABASE_PATH = environ["DATABASE_PATH"]


__all__ = ["ArtistSubsonicDatabase", "get_metadata"]


class ArtistSubsonicDatabase(SubsonicDatabase):
    def __init__(self):
        super().__init__(DATABASE_PATH, None, True)

    def create(self):
        super().create()
        # Additional tables we want to keep track of resolved artists
        db.create_tables((Artist, RecordingArtist, Session))

    def connect(self):
        return CustomConnection(
            username=SUBSONIC_BACKEND_USER, password=SUBSONIC_BACKEND_PASS
        )


class ArtistMetadata(TypedDict):
    count: int
    mbid: str
    name: str
    subsonic_id: Optional[str]
    subsonic_name: Optional[str]


class TagMetadata(TypedDict):
    count: int
    name: str


class Metadata(TypedDict):
    artists: List[ArtistMetadata]
    resolved_recordings: int
    tags: List[TagMetadata]


def get_metadata() -> Metadata:
    try:
        setup_db(DATABASE_PATH)
        db.connect()

        with db.atomic():
            query = """
SELECT name, mbid, subsonic_name, subsonic_id, COUNT(recording_artist.recording_id)
FROM artist
JOIN recording_artist
    ON recording_artist.artist_id = artist.mbid
GROUP BY recording_artist.artist_id"""
            artists: List[ArtistMetadata] = []
            cursor = db.execute_sql(query)
            for name, mbid, subsonic_name, subsonic_id, count in cursor.fetchall():
                artists.append(
                    {
                        "name": name,
                        "mbid": mbid,
                        "subsonic_name": subsonic_name,
                        "subsonic_id": subsonic_id,
                        "count": count,
                    }
                )

            query = """
SELECT tag.name, COUNT(tag.id) AS cnt
FROM tag
JOIN recording_tag
    ON recording_tag.tag_id = tag.id
JOIN recording
    ON recording_tag.recording_id = recording.id
GROUP BY tag.name
ORDER BY cnt DESC"""

            cursor = db.execute_sql(query)

            tags: List[TagMetadata] = []
            for rec in cursor.fetchall():
                tags.append({"name": rec[0], "count": rec[1]})

            resolved_recordings = db.execute_sql(
                "SELECT COUNT(*) from recording"
            ).fetchone()[0]

        return {
            "artists": artists,
            "resolved_recordings": resolved_recordings,
            "tags": tags,
        }
    finally:
        db.close()


def get_sessions(username: str) -> List[dict]:
    try:
        setup_db(DATABASE_PATH)
        db.connect()

        return list(
            Session.select(Session.id, Session.name, Session.seen.length())
            .where(Session.username == username)
            .dicts()
        )
    finally:
        db.close()
