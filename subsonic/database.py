from typing import List

from os import environ

from troi.content_resolver.database import db
from troi.content_resolver.subsonic import SubsonicDatabase
from troi.content_resolver.model.database import setup_db

from .artist import Artist, RecordingArtist
from .custom_connection import CustomConnection

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
        db.create_tables((Artist, RecordingArtist))

    def connect(self):
        return CustomConnection(
            username=SUBSONIC_BACKEND_USER, password=SUBSONIC_BACKEND_PASS
        )


def get_metadata() -> dict:
    try:
        setup_db(DATABASE_PATH)
        db.connect()

        with db.atomic():
            query = """
SELECT name, mbid, subsonic_name, COUNT(recording_artist.recording_id)
FROM artist
JOIN recording_artist
    ON recording_artist.artist_id = artist.mbid
GROUP BY recording_artist.artist_id"""
            artists: List[dict] = []
            cursor = db.execute_sql(query)
            for name, mbid, subsonic_name, count in cursor.fetchall():
                artists.append(
                    {
                        "name": name,
                        "mbid": mbid,
                        "subsonic_name": subsonic_name,
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

            tags: List[dict] = []
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
