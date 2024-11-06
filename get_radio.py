from typing import Dict, List

from os import environ

from importlib.util import module_from_spec, spec_from_file_location
from json import loads, dumps
from sys import modules, stdin


fuzzy_spec = spec_from_file_location(
    "troi.content_resolver.fuzzy_index", "subsonic/fuzzy_index.py"
)
fuzzy_module = module_from_spec(fuzzy_spec)
modules["troi.content_resolver.fuzzy_index"] = fuzzy_module
fuzzy_spec.loader.exec_module(fuzzy_module)

from subsonic.patch import *

from troi import Artist, ArtistCredit, Playlist, Recording, Release
from troi.content_resolver.database import db
from troi.content_resolver.lb_radio import ListenBrainzRadioLocal
from troi.content_resolver.model.database import setup_db

from subsonic.custom_connection import CustomConnection

DATABASE_PATH = environ["DATABASE_PATH"]
PROXY_IMAGES = environ.get("PROXY_IMAGES", "").lower() == "true"


def get_radio(
    mode: str, prompt: str, credentials: Dict[str, str], quiet=False
) -> "dict":
    try:
        setup_db(DATABASE_PATH)
        db.connect()

        r = ListenBrainzRadioLocal(quiet)
        data = r.generate(mode, prompt, 0.8)
        try:
            _ = data.playlists[0].recordings[0]
        except (KeyError, IndexError, AttributeError):
            return {}

        playlist: "Playlist" = data.playlists[0]
        recordings: List["Recording"] = playlist.recordings

        output_json: "List[dict]" = []

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

            recording_json = {
                "durationMs": recording.duration,
                "id": subsonic_id,
                "mbid": recording.mbid,
                "title": recording.name,
                "url": get_url(subsonic_id),
                "year": recording.year,
            }

            if recording.artist_credit:
                credits: "ArtistCredit" = recording.artist_credit
                artists: "List[Artist]" = credits.artists

                recording_json["artists"] = [
                    {"mbid": artist.mbid, "name": artist.name} for artist in artists
                ]

            if recording.release:
                release: "Release" = recording.release
                recording_json["release"] = {"mbid": release.mbid, "name": release.name}

            output_json.append(recording_json)

        return {
            "name": playlist.name,
            "recordings": output_json,
        }
    finally:
        db.close()


ALLOWED_MODES = {"easy", "medium", "hard"}

if __name__ == "__main__":
    params = loads(stdin.readline())
    mode = params["mode"]

    if mode not in ALLOWED_MODES:
        raise Exception(f"Unexpected mode {mode}")

    prompt = params["prompt"]
    assert isinstance(prompt, str), "Invalid prompt"

    credentials = params["credentials"]
    assert isinstance(credentials, dict)

    quiet = params.get("quiet", False)
    if quiet == "false" or quiet == "False" or quiet == False:
        quiet = False
    else:
        quiet = bool(quiet)

    for key, value in credentials.items():
        assert isinstance(key, str) and isinstance(
            value, str
        ), "credentials must be string"

    results = get_radio(mode, prompt, credentials)
    print(dumps(results), end="")
