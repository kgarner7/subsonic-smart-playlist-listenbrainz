import troi.musicbrainz.recording_lookup as rl


class FixedLookup(rl.RecordingLookupElement):
    BATCH_SIZE = 1000

    def read(self, inputs):
        if isinstance(inputs[0], rl.Playlist):
            recordings = inputs[0].recordings
        else:
            recordings = inputs[0]

        if len(recordings) > self.BATCH_SIZE:
            output = []
            for idx in range(0, len(recordings), self.BATCH_SIZE):
                partial = super().read([recordings[idx : idx + self.BATCH_SIZE]])
                output.extend(partial)

            return output
        else:
            return super().read([recordings])
