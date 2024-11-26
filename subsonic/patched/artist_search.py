from collections import defaultdict

from troi.content_resolver import artist_search
from troi.content_resolver.model.database import db
from troi.content_resolver.model.recording import FileIdType
from troi.content_resolver.utils import select_recordings_on_popularity

__all__ = ["MultivaluedLocalRecordingSearchByArtistService"]


class MultivaluedLocalRecordingSearchByArtistService(
    artist_search.LocalRecordingSearchByArtistService
):
    """
    A patched ArtistSearch service with a couple of fixes:
    1. Actually respect max_similar_artists (and when 0, don't fetch at all)
    2. Add the artist being searched to the list of artist mbids
    3. Use multivalued join (singe we have those)
    """

    def search(
        self,
        mode,
        artist_mbid,
        pop_begin,
        pop_end,
        max_recordings_per_artist,
        max_similar_artists,
    ):
        """
        Perform an artist search. Parameters:

        mode: the mode used for this artist search
        pop_begin: if many recordings match the above parameters, return only
                       recordings that have a minimum popularity percent score
                       of pop_begin.
        pop_end: if many recordings match the above parameters, return only
                     recordings that have a maximum popularity percent score
                     of pop_end.
        max_recordings_per_artist: The number of recordings to collect for each artist.
        max_similar_artists: The maximum number of similar artists to select.

        If only few recordings match, the pop_begin and pop_end are ignored.
        """

        if max_similar_artists > 0:
            similar_artists = self.get_similar_artists(artist_mbid)
        else:
            similar_artists = []

        query = """SELECT IFNULL(popularity, 0) pop
                        , recording_mbid
                        , artist_id
                        , file_id
                     FROM recording
                LEFT JOIN recording_metadata
                       ON recording.id = recording_metadata.recording_id
                     JOIN recording_artist
                       ON recording_artist.recording_id = recording.id
                    WHERE artist_id in (%s)
                 ORDER BY artist_id
                        , pop"""

        artist_mbids = [artist["artist_mbid"] for artist in similar_artists]
        artist_mbids.append(artist_mbid)
        placeholders = ",".join(("?",) * len(artist_mbids))
        cursor = db.execute_sql(query % placeholders, params=artist_mbids)

        artists = defaultdict(list)
        for popularity, recording_mbid, artist_mbid, file_id in cursor.fetchall():
            artists[artist_mbid].append(
                {
                    "popularity": popularity,
                    "recording_mbid": recording_mbid,
                    "artist_mbid": artist_mbid,
                    "file_id": file_id,
                    "file_id_type": FileIdType.SUBSONIC_ID,
                }
            )

        for artist in artists:
            artists[artist] = select_recordings_on_popularity(
                artists[artist], pop_begin, pop_end, max_recordings_per_artist
            )

        return artists, []
