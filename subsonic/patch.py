from troi.content_resolver import artist_search
import troi.musicbrainz.recording_lookup as rl
from troi.patches.lb_radio_classes import blend

from .patched_artist_search import MultivaluedLocalRecordingSearchByArtistService
from .patched_blend import WeightAndBlendAllowExcessArtistsToHitTarget
from .patched_lookup import FixedLookup

artist_search.LocalRecordingSearchByArtistService = (
    MultivaluedLocalRecordingSearchByArtistService
)
blend.WeighAndBlendRecordingsElement = WeightAndBlendAllowExcessArtistsToHitTarget
rl.RecordingLookupElement = FixedLookup
