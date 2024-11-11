from typing import Dict, List, NotRequired, Optional, TypedDict

from datetime import datetime
from os import environ

from json import loads, dumps
from sys import stdin
from subsonic.patched.monkeypatch import monkeypatch

# Monkeypatch. This overrides fuzzy index to always use MBID (or lookup MBID).
# This allows for importing Troi without scikit-learn/numpy
monkeypatch("troi.content_resolver.fuzzy_index", "subsonic/patched/fuzzy_index.py")

from subsonic.patched.exclude import excluded_mbids
from subsonic.patched.patch import *

from peewee import DoesNotExist
from troi import Artist, ArtistCredit, Playlist, Recording, Release
from troi.content_resolver.database import db
from troi.content_resolver.lb_radio import ListenBrainzRadioLocal
from troi.content_resolver.model.database import setup_db

from subsonic.custom_connection import CustomConnection
from subsonic.schema import CreateRadioWithCredentials, PromptType
from subsonic.session import Session


DATABASE_PATH = environ["DATABASE_PATH"]
PROXY_IMAGES = environ.get("PROXY_IMAGES", "").lower() == "true"


class MbzData(TypedDict):
    mbid: str
    name: str


class RecordingData(TypedDict):
    artists: NotRequired[List[MbzData]]
    durationMs: int
    id: str
    mbid: str
    release: NotRequired[MbzData]
    title: str
    url: str
    year: int


class RadioInfo(TypedDict):
    name: str
    recordings: List[RecordingData]
    session: NotRequired[Optional[int]]


def get_radio(
    mode: str, prompt: str, credentials: Dict[str, str], quiet=False
) -> Optional[RadioInfo]:
    r = ListenBrainzRadioLocal(quiet)
    data = r.generate(mode, prompt, 0.8)

    try:
        _ = data.playlists[0].recordings[0]
    except (KeyError, IndexError, AttributeError):
        return None

    playlist: "Playlist" = data.playlists[0]
    recordings: List["Recording"] = playlist.recordings

    output_json: "List[RecordingData]" = []

    if PROXY_IMAGES:

        def get_url(id: str):
            return f"./api/proxy/{id}"

    else:
        conn = CustomConnection(credentials=credentials)

        def get_url(id: str):
            req = conn._getRequest("getCoverArt.view", {"id": id, "size": 100})
            return f"{req.full_url}?{req.data.decode()}"

    for recording in recordings:
        subsonic_id = recording.musicbrainz["subsonic_id"]

        recording_json = RecordingData(
            durationMs=recording.duration,
            id=subsonic_id,
            mbid=recording.mbid,
            title=recording.name,
            url=get_url(subsonic_id),
            year=recording.year,
        )

        if recording.artist_credit:
            credits: "ArtistCredit" = recording.artist_credit
            artists: "List[Artist]" = credits.artists

            recording_json["artists"] = [
                MbzData(mbid=artist.mbid, name=artist.name) for artist in artists
            ]

        if recording.release:
            release: "Release" = recording.release
            recording_json["release"] = MbzData(mbid=release.mbid, name=release.name)

        output_json.append(recording_json)

    return {
        "name": playlist.name,
        "recordings": output_json,
    }


if __name__ == "__main__":
    data = loads(stdin.readline())
    json = CreateRadioWithCredentials().load(data)

    credentials = json["credentials"]
    prompt = json["prompt"]

    setup_db(DATABASE_PATH)
    db.connect()

    is_session = prompt["type"] == PromptType.SESSION.value

    if is_session:
        try:
            session: "Session" = (
                Session.select(Session.mode, Session.prompt, Session.seen)
                .where(Session.username == credentials["u"], Session.id == prompt["id"])
                .get()
            )
            create_session = False

            mode = session.mode
            text = session.prompt
            if session.seen:
                excluded_mbids.update(session.seen)
        except DoesNotExist:
            raise Exception(f"No session with id {prompt["id"]}")
    else:
        mode = prompt["mode"].value
        text = prompt["prompt"]
        create_session = prompt.get("session", False)

    results = get_radio(mode, text, credentials, json.get("quiet", False))

    if results is None:
        if is_session:
            Session.delete_by_id(prompt["id"])
            raise Exception("This session has exhausted all available songs")

        raise Exception("Could not find any tracks to create a playlist")

    if create_session:
        if len(results["recordings"]) < 50:
            results["session"] = None
        else:
            seen_ids = [r["mbid"] for r in results["recordings"]]
            id = Session.insert(
                username=credentials["u"],
                name=results["name"],
                prompt=text,
                mode=mode,
                seen=seen_ids,
                last_updated=datetime.now(),
            ).execute()
            results["session"] = id
    elif is_session:
        if len(results["recordings"]) < 50:
            Session.delete_by_id(prompt["id"]).execute()
            results["session"] = None
        else:
            seen_ids = [r["mbid"] for r in results["recordings"]]
            Session.update(seen=Session.seen.set(session.seen + seen_ids)).where(
                Session.id == prompt["id"]
            ).execute()
            results["session"] = prompt["id"]

    print(dumps(results), end="")
