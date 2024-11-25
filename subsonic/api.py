from typing import List, Optional, TypedDict

from datetime import datetime

from troi.content_resolver.database import db

from .schema import *
from .session import Session


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


### Session related Routes


def create_session(username: str, data: "CreateSession") -> int:
    id = Session.insert(
        username=username,
        name=data.name,
        prompt=data.prompt,
        mode=data.mode,
        seen=data.mbids,
        last_updated=datetime.now(),
    ).execute()

    return id


def delete_session(username: str, id: int) -> None:
    Session.delete().where(Session.username == username, Session.id == id).execute()


def get_sessions(username: str) -> List[dict]:
    return list(
        Session.select(Session.id, Session.name, Session.seen.length())
        .where(Session.username == username)
        .dicts()
    )
