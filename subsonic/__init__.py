from troi.content_resolver import artist_search
import troi.musicbrainz.recording_lookup as rl

from .patched_artist_search import MultivaluedLocalRecordingSearchByArtistService
from .patched_lookup import FixedLookup

artist_search.LocalRecordingSearchByArtistService = (
    MultivaluedLocalRecordingSearchByArtistService
)
rl.RecordingLookupElement = FixedLookup
