from troi.content_resolver import artist_search
from troi import filters, playlist
from troi.musicbrainz import recording_lookup as rl
from troi.patches.lb_radio_classes import blend

from .artist_search import MultivaluedLocalRecordingSearchByArtistService
from .blend import WeightAndBlendAllowExcessArtistsToHitTarget
from .hated_filter import HatedSubsonicRecordingsFilterElement
from .lookup import BatchedLookupWithExclude
from .playlist import PlaylistElement

artist_search.LocalRecordingSearchByArtistService = (
    MultivaluedLocalRecordingSearchByArtistService
)
blend.WeighAndBlendRecordingsElement = WeightAndBlendAllowExcessArtistsToHitTarget
filters.HatedRecordingsFilterElement = HatedSubsonicRecordingsFilterElement
playlist.PlaylistElement = PlaylistElement
rl.RecordingLookupElement = BatchedLookupWithExclude
