from troi.musicbrainz.recording_lookup import Playlist, RecordingLookupElement

from .exclude import excluded_mbids

__all__ = ["BatchedLookupWithExclude"]


class BatchedLookupWithExclude(RecordingLookupElement):
    BATCH_SIZE = 1000

    def read(self, inputs):
        if isinstance(inputs[0], Playlist):
            recordings = inputs[0].recordings
        else:
            recordings = inputs[0]

        if excluded_mbids:
            recordings = [rec for rec in recordings if rec.mbid not in excluded_mbids]

        if len(recordings) > self.BATCH_SIZE:
            output = []
            for idx in range(0, len(recordings), self.BATCH_SIZE):
                partial = super().read([recordings[idx : idx + self.BATCH_SIZE]])
                output.extend(partial)

            return output
        else:
            return super().read([recordings])
