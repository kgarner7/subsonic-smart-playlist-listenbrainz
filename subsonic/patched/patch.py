from troi.content_resolver import artist_search
from troi import playlist
import troi.musicbrainz.recording_lookup as rl
from troi.patches.lb_radio_classes import blend

from .artist_search import MultivaluedLocalRecordingSearchByArtistService
from .blend import WeightAndBlendAllowExcessArtistsToHitTarget
from .lookup import BatchedLookupWithExclude
from .playlist import PlaylistElement

artist_search.LocalRecordingSearchByArtistService = (
    MultivaluedLocalRecordingSearchByArtistService
)
blend.WeighAndBlendRecordingsElement = WeightAndBlendAllowExcessArtistsToHitTarget
playlist.PlaylistElement = PlaylistElement
rl.RecordingLookupElement = BatchedLookupWithExclude
