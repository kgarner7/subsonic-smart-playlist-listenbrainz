from typing import List

from troi import Recording
from troi.content_resolver.database import db
from troi.filters import HatedRecordingsFilterElement


HATED_QUERY = """
SELECT recording_mbid
FROM rating
JOIN recording
ON rating.recording_id = recording.file_id
WHERE rating.rating = 1
AND recording_mbid IN (
"""


class HatedSubsonicRecordingsFilterElement(HatedRecordingsFilterElement):
    BATCH_SIZE = 500

    def read(self, inp: List[List["Recording"]]) -> List["Recording"]:
        inputs = inp[0]
        final_recordings: List["Recording"] = []

        with db.atomic():
            for batch_start in range(0, len(inputs), self.BATCH_SIZE):
                ids = [
                    r.mbid for r in inputs[batch_start : batch_start + self.BATCH_SIZE]
                ]

                params = ", ".join(["?"] * len(ids))

                excluded_mbids = set(
                    mbid
                    for (mbid,) in db.execute_sql(
                        HATED_QUERY + params + ")", params=ids
                    ).fetchall()
                )

                final_recordings += [
                    r
                    for r in inputs[batch_start : batch_start + self.BATCH_SIZE]
                    if r.mbid not in excluded_mbids
                ]

        return final_recordings
