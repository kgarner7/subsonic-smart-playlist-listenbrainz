from multiprocessing.sharedctypes import SynchronizedArray
from typing import Dict, List, Set, Tuple

from datetime import datetime
from enum import Enum
from os import environ

from troi import Artist, ArtistCredit, Playlist, Recording, Release
from troi.content_resolver.database import db
from troi.content_resolver.lb_radio import ListenBrainzRadioLocal
from troi.content_resolver.metadata_lookup import MetadataLookup, RecordingRow
from troi.content_resolver.subsonic import SubsonicDatabase
from troi.content_resolver.model.database import setup_db
from troi.content_resolver.model.recording import Recording as DBRecording, FileIdType

from .artist import Artist as DBArtist, RecordingArtist
from .custom_connection import CustomConnection
from .patched_lookup import FixedLookup

__all__ = ["ProcessLocalSubsonicDatabase", "ScanState"]


SUBSONIC_BACKEND_USER = environ["SUBSONIC_BACKEND_USER"]
SUBSONIC_BACKEND_PASS = environ["SUBSONIC_BACKEND_PASS"]
DATABASE_PATH = environ["DATABASE_PATH"]
PROXY_IMAGES = environ.get("PROXY_IMAGES", "").lower() == "true"


class ScanState(Enum):
    IDLE = 0
    SUBSONIC = 1
    METADATA = 2
    TAGS = 3
    DONE = 4


class ProgressMetadataLookup(MetadataLookup):
    """
    A custom MetadataLookup class that counts the number of
    recordings fetched
    """

    def __init__(self, state: "SynchronizedArray[int]"):
        self.state = state
        super().__init__(True)

    def process_recordings(self, recordings: "List[RecordingRow]"):
        try:
            return super().process_recordings(recordings)
        finally:
            with self.state.get_lock():
                self.state[3] += len(recordings)


class ProcessLocalSubsonicDatabase(SubsonicDatabase):
    LOOKUP_BATCH_SIZE = 1000

    def __init__(self, state: "SynchronizedArray[int]") -> None:
        self.state = state
        """
        Process-safe progress tracker. Has the following meanings:
        - [0]: Fetched subsonic tracks
        - [1]: Metadata lookup progress
        - [2]: Metadata lookup total
        - [3]: Popularity lookup progress. Note that this count (if specified) is also metadata lookup count
        - [4]: Mode
        """
        self.metadata_lookup = ProgressMetadataLookup(state)
        super().__init__(DATABASE_PATH, None, False)

    def create(self):
        super().create()
        # Additional tables we want to keep track of resolved artists
        db.create_tables((DBArtist, RecordingArtist))

    def connect(self):
        return CustomConnection(
            username=SUBSONIC_BACKEND_USER, password=SUBSONIC_BACKEND_PASS
        )

    def run_sync(self, full=False) -> None:
        """
        Perform the sync between the local collection and the subsonic one.

        WARNING: This operation is **not** atomic. If there are other processes
        that attempt to **update** the database while the sync is running, then
        there may be unexpected behavior. The assumption is that there is
        precisely one thread/process that is calling run_sync.

        Note that unlike the original Troi implementation, this function relies on
        ListenBrainz for most of the metadata (specifically, artist/release mbid).

        This makes for faster Subsonic iteration (since you just have to iterate by batches of 500 songs),
        but then has the requirement of querying recording metadata from ListenBrainz in batches of ~1000 songs.

        Additionally, this call _also_ fetches tags as the third pass.
        While it is possible to only do one ListenBrainz call, this would
        miss popularity.

        Finally, we support partial scans (default, full=False). This means
        that this function will check for existing (subsonic id, recording mbid)
        pairs, and for recordings retrieved these will not be fetched again.
        This should significantly improve successive scans from the metadata
        lookup perspective.
        """
        conn = self.connect()
        if not conn:
            return

        existing_subsonic_id_to_mbid: Dict[str, str] = {}
        # The index (although not in the database currently) is basically
        # (subsonic_id, recording_mbid). Use this to store existing id
        # to allow for upserts later
        existing_mbid_subsonic_id_to_id: Dict[Tuple[str, str], int] = {}
        seen_existing_ids: Set[str] = set()

        for recording in DBRecording.select(
            DBRecording.id, DBRecording.file_id, DBRecording.recording_mbid
        ).where(DBRecording.file_id_type == FileIdType.SUBSONIC_ID):
            existing_subsonic_id_to_mbid[recording.file_id] = recording.recording_mbid
            existing_mbid_subsonic_id_to_id[
                (recording.file_id, recording.recording_mbid)
            ] = recording.id

        existing_artist_mbids: Set[str] = set()
        for artist in DBArtist.select(DBArtist.mbid):
            existing_artist_mbids.add(artist.mbid)

        songs_to_resolve: List[dict] = []
        songs_without_mbid: List[dict] = []
        offset = 0

        song_count = self.BATCH_SIZE
        while song_count == self.BATCH_SIZE:
            # Assumption: we are using an OpenSubsonic server which supports
            # iterating through all the tracks using an empty query
            results = conn.search3(
                "",
                artistCount=0,
                albumCount=0,
                songCount=self.BATCH_SIZE,
                songOffset=offset,
            )

            songs: "List[dict]" = results["searchResult3"]["song"]
            for song in songs:
                mbid = song.get("musicBrainzId")
                id = song["id"]

                if not mbid:
                    songs_without_mbid.append(song)
                elif full or existing_subsonic_id_to_mbid.get(id) != mbid:
                    # this happens either if the song doesn't exist, or (for some reason)
                    # the MusicBrainz ID changed
                    songs_to_resolve.append(song)
                else:
                    # fallthrough case; the MBID does exist. Because there may
                    # be duplicate tracks with the same MBID, mark it as being seen
                    # but DO NOT clear out the dict yet
                    seen_existing_ids.add(id)

            song_count = len(songs)
            offset += song_count

            self.state[0] = offset

        lookup = FixedLookup()
        now = datetime.now()

        songs_to_create_or_upsert = len(songs_to_resolve)

        with self.state.get_lock():
            self.state[1] = 0
            self.state[2] = songs_to_create_or_upsert
            self.state[3] = 0
            self.state[4] = ScanState.METADATA.value

        for idx in range(0, songs_to_create_or_upsert, self.LOOKUP_BATCH_SIZE):
            mbid_to_songs: Dict[str, List[dict]] = {}
            recordings_to_search: List["Recording"] = []

            for song in songs_to_resolve[idx : idx + self.LOOKUP_BATCH_SIZE]:
                mbid = song["musicBrainzId"]

                # Allow duplicate items, but only lookup the recording once
                if mbid in mbid_to_songs:
                    mbid_to_songs[mbid].append(song)
                else:
                    mbid_to_songs[mbid] = [song]
                    recordings_to_search.append(Recording(mbid=mbid))

            resolved_recordings: "List[Recording]" = lookup.read(
                (recordings_to_search,)
            )

            with db.atomic():
                recording_rows: "List[RecordingRow]" = []

                for recording in resolved_recordings:
                    # This _should_ never be empty, but just in case
                    songs = mbid_to_songs.get(recording.mbid, [])

                    # There could be multiple songs with the same recording id
                    for song in songs:
                        if recording.release:
                            release: "Release" = recording.release
                            release_mbid = release.mbid
                            release_name = release.name
                        else:
                            # Release may be null. In this case, use release name
                            # from Subsonic. Leave release mbid empty
                            release_mbid = None
                            release_name = song["album"]

                        if recording.artist_credit:
                            credits: "ArtistCredit" = recording.artist_credit
                            artists: "List[Artist]" = credits.artists

                            # The schema expects a single artist mbid for a recording
                            # However, we will have an additional table to track the M2M association
                            if artists:
                                artist_mbid = artists[0].mbid
                            artist_name = credits.name

                            for artist in artists:
                                if artist.mbid not in existing_artist_mbids:
                                    existing_artist_mbids.add(artist.mbid)

                                    DBArtist.insert(
                                        mbid=artist.mbid, name=artist.name
                                    ).execute()
                        else:
                            # If there is no artist credit resolved, use the
                            # name from Subsonic and have no credits
                            artist_name = song["artist"]
                            artists = []
                            artist_mbid = None

                        duration = (
                            recording.duration
                            if recording.duration
                            else song["duration"] * 1000
                        )

                        # track/disc number are not guaranteed
                        track_num = song.get("track", 1)
                        disc_num = song.get("discNumber", 1)

                        id = existing_mbid_subsonic_id_to_id.get(
                            (song["id"], recording.mbid)
                        )

                        create_or_upsert_args = dict(
                            id=id,
                            file_id=song["id"],
                            file_id_type=FileIdType.SUBSONIC_ID,
                            artist_name=artist_name,
                            release_name=release_name,
                            recording_name=recording.name,
                            artist_mbid=artist_mbid,
                            recording_mbid=recording.mbid,
                            release_mbid=release_mbid,
                            mtime=now,
                            duration=duration,
                            track_num=track_num,
                            disc_num=disc_num,
                        )

                        if full and create_or_upsert_args["id"] is not None:
                            recording_id = (
                                DBRecording.insert(create_or_upsert_args)
                                .on_conflict_replace()
                                .execute()
                            )
                            seen_existing_ids.add(song["id"])

                            artist_tags_to_insert = [
                                {"artist_id": artist.mbid, "recording_id": recording_id}
                                for artist in artists
                            ]

                            RecordingArtist.delete().where(
                                RecordingArtist.recording_id == song["id"]
                            ).execute()

                            RecordingArtist.insert_many(artist_tags_to_insert).execute()

                        else:
                            new_recording: "DBRecording" = DBRecording.create(
                                **create_or_upsert_args
                            )

                            artist_tags_to_insert = [
                                {
                                    "artist_id": artist.mbid,
                                    "recording_id": new_recording.id,
                                }
                                for artist in artists
                            ]
                            RecordingArtist.insert_many(artist_tags_to_insert).execute()

                            recording_rows.append(
                                RecordingRow(
                                    new_recording.id, new_recording.recording_mbid, None
                                )
                            )

                if not full:
                    self.metadata_lookup.process_recordings(recording_rows)

                self.state[1] = min(
                    idx + self.LOOKUP_BATCH_SIZE, songs_to_create_or_upsert
                )

        if full:
            self.state[4] = ScanState.TAGS.value
            self.metadata_lookup.lookup()

        # Remove all artists that no longer have any associated recordings
        db.execute_sql(
            """
DELETE FROM artist
WHERE mbid IN (
    SELECT mbid
    FROM artist
    LEFT JOIN recording_artist
    ON artist.mbid = recording_artist.artist_id
    WHERE recording_artist.id IS NULL
)
"""
        )

        # Do the same thing for tags
        db.execute_sql(
            """
DELETE FROM tag
WHERE id IN (
    SELECT tag.id
    FROM tag
    LEFT JOIN recording_tag
    ON tag.id = recording_tag.tag_id
    WHERE recording_tag.id IS NULL
)
"""
        )

        missing_ids = [
            item
            for item in existing_subsonic_id_to_mbid
            if item not in seen_existing_ids
        ]

        # Delete ids that were not found. Do this in chunks of 500
        with db.atomic():
            for chunk in range(0, len(missing_ids), 500):
                DBRecording.delete(
                    DBRecording.file_id.in_(missing_ids[chunk : chunk + 500])
                    & DBRecording.file_id_type
                    == FileIdType.SUBSONIC_ID
                )

        self.state[4] = ScanState.DONE.value


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


def get_radio(
    mode: str, prompt: str, credentials: Dict[str, str], quiet=True
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
                return f"{req.full_url}?{req.data}"

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
