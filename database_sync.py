from typing import Dict, List, Set, Tuple

from datetime import datetime

from subsonic.artist import Artist as DBArtist, RecordingArtist
from subsonic.database import ArtistSubsonicDatabase

from troi import Artist, ArtistCredit, Recording, Release
from troi.content_resolver.database import db
from troi.content_resolver.metadata_lookup import MetadataLookup, RecordingRow
from troi.musicbrainz.recording_lookup import RecordingLookupElement
from troi.content_resolver.model.recording import Recording as DBRecording, FileIdType


DuplicateRecordings = Dict[str, List[dict]]


class ProcessLocalSubsonicDatabase(ArtistSubsonicDatabase):
    LOOKUP_BATCH_SIZE = 1000

    def __init__(self, full=False) -> None:
        self.full = full

        # Lookups
        self.metadata_lookup = MetadataLookup(True)
        self.recording_lookup = RecordingLookupElement()

        # Store existing ids
        self.existing_artists: Set[str] = set()
        self.existing_artist_mbids_to_subsonic: Dict[str, Tuple[str, str] | None] = (
            dict()
        )
        self.existing_mbid_subsonic_id_to_id: Dict[Tuple[str, str], int] = {}
        self.existing_subsonic_id_to_mbid: Dict[str, str] = {}
        self.seen_existing_ids: Set[str] = set()

        super().__init__()

    def run_sync(self) -> None:
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

        self.fetch_existing_data()

        artists_index = conn.getArtists()["artists"]["index"]

        # OS Servers are required to have it (empty) if they support it
        if "musicBrainzId" in artists_index[0]["artist"][0]:
            artist_updates: List[DBArtist] = []

            for index in artists_index:
                for artist in index["artist"]:
                    mbid = artist.get("musicBrainzId")

                    if mbid:
                        if mbid in self.existing_artist_mbids_to_subsonic:
                            existing = self.existing_artist_mbids_to_subsonic[mbid]
                            if existing is None or (
                                existing[0] != artist["name"]
                                or existing[1] != artist["id"]
                            ):
                                artist_updates.append(
                                    DBArtist(
                                        mbid=mbid,
                                        subsonic_name=artist["name"],
                                        subsonic_id=artist["id"],
                                    )
                                )
                        else:
                            self.existing_artist_mbids_to_subsonic[mbid] = (
                                artist["name"],
                                artist["id"],
                            )

            if artist_updates:
                with db.atomic():
                    DBArtist.bulk_update(
                        artist_updates, fields=[DBArtist.subsonic_name], batch_size=50
                    )

        songs_to_resolve: List[dict] = []
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
                    continue
                elif self.full or self.existing_subsonic_id_to_mbid.get(id) != mbid:
                    # this happens either if the song doesn't exist, or (for some reason)
                    # the MusicBrainz ID changed
                    songs_to_resolve.append(song)
                else:
                    # fallthrough case; the MBID does exist. Because there may
                    # be duplicate tracks with the same MBID, mark it as being seen
                    # but DO NOT clear out the dict yet
                    self.seen_existing_ids.add(id)

            song_count = len(songs)
            offset += song_count

            if len(songs_to_resolve) >= self.LOOKUP_BATCH_SIZE:
                # When we have enough songs (1000), we do the following:
                self.lookup_and_resolve_songs_metadata(
                    songs_to_resolve[: self.LOOKUP_BATCH_SIZE]
                )

                songs_to_resolve = songs_to_resolve[self.LOOKUP_BATCH_SIZE :]

            print(offset, flush=True)

        while songs_to_resolve:
            self.lookup_and_resolve_songs_metadata(
                songs_to_resolve[: self.LOOKUP_BATCH_SIZE]
            )
            songs_to_resolve = songs_to_resolve[self.LOOKUP_BATCH_SIZE :]

        self.cleanup()

    def fetch_existing_data(self):
        """
        Fetch existing data, to allow for fast sync in later steps.
        Specifically, fetches existing recordings and artists
        """
        for recording in DBRecording.select(
            DBRecording.id, DBRecording.file_id, DBRecording.recording_mbid
        ).where(DBRecording.file_id_type == FileIdType.SUBSONIC_ID):
            self.existing_subsonic_id_to_mbid[recording.file_id] = (
                recording.recording_mbid
            )
            self.existing_mbid_subsonic_id_to_id[
                (recording.file_id, recording.recording_mbid)
            ] = recording.id

        for artist in DBArtist.select(
            DBArtist.mbid, DBArtist.subsonic_name, DBArtist.subsonic_id
        ):
            self.existing_artists.add(artist.mbid)
            self.existing_artist_mbids_to_subsonic[artist.mbid] = (
                artist.subsonic_name,
                artist.subsonic_id,
            )

    def lookup_and_resolve_songs_metadata(self, songs: List[dict]) -> None:
        # 1. Bulk lookup the metadata from ListenBrainz
        recordings, duplicates = self.lookup_recordings(songs)

        # 2. Create or update the recording metadata and artists.
        metadata_to_fetch = self.process_recording_metadata(recordings, duplicates)

        # It's possible that this list is empty
        if metadata_to_fetch:
            # 3. Lookup tags and popularity of stored tags
            self.metadata_lookup.process_recordings(metadata_to_fetch)

    def lookup_recordings(
        self, recordings: List["dict"]
    ) -> Tuple[List["Recording"], DuplicateRecordings]:
        """
        Lookup a list recordings up to 1000 tracks long in ListenBrainz
        to get recording and artist credit metadata
        """
        mbid_to_songs: DuplicateRecordings = {}
        recordings_to_search: List["Recording"] = []

        for song in recordings:
            mbid = song["musicBrainzId"]

            if mbid in mbid_to_songs:
                mbid_to_songs[mbid].append(song)
            else:
                mbid_to_songs[mbid] = [song]
                recordings_to_search.append(Recording(mbid=mbid))

        return (self.recording_lookup.read((recordings_to_search,)), mbid_to_songs)

    def process_recording_metadata(
        self,
        resolved_recordings: List["Recording"],
        mbid_to_songs: DuplicateRecordings,
    ) -> List["RecordingRow"]:
        now = datetime.now()
        metadata_lookup_rows: "List[RecordingRow]" = []

        with db.atomic():
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
                            if artist.mbid not in self.existing_artists:
                                self.existing_artists.add(artist.mbid)

                                existing_data = (
                                    self.existing_artist_mbids_to_subsonic.get(
                                        artist.mbid
                                    )
                                )

                                DBArtist.insert(
                                    mbid=artist.mbid,
                                    name=artist.name,
                                    subsonic_name=(
                                        None if not existing_data else existing_data[0]
                                    ),
                                    subsonic_id=(
                                        None if not existing_data else existing_data[1]
                                    ),
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

                    id = self.existing_mbid_subsonic_id_to_id.get(
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

                    if self.full and create_or_upsert_args["id"] is not None:
                        recording_id = (
                            DBRecording.insert(create_or_upsert_args)
                            .on_conflict_replace()
                            .execute()
                        )
                        self.seen_existing_ids.add(song["id"])

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
                        recording_id = new_recording.id

                    metadata_lookup_rows.append(
                        RecordingRow(recording_id, recording.mbid, recording_id)
                    )

        return metadata_lookup_rows

    def cleanup(self):
        missing_ids = [
            item
            for item in self.existing_subsonic_id_to_mbid
            if item not in self.seen_existing_ids
        ]

        # Delete ids that were not found. Do this in chunks of 500
        with db.atomic():
            for chunk in range(0, len(missing_ids), 500):
                DBRecording.delete().where(
                    DBRecording.file_id.in_(missing_ids[chunk : chunk + 500]),
                    DBRecording.file_id_type == FileIdType.SUBSONIC_ID,
                )

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


if __name__ == "__main__":
    from sys import argv

    full = len(argv) > 1 and argv[1] == "--full"

    lookup = ProcessLocalSubsonicDatabase(full)
    lookup.open()
    lookup.run_sync()
