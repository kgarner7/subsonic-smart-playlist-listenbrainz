from typing import Dict, List

from collections import defaultdict
from random import randint

from troi import Recording
from troi.patches.lb_radio_classes.blend import WeighAndBlendRecordingsElement


class WeightAndBlendAllowExcessArtistsToHitTarget(WeighAndBlendRecordingsElement):
    MAX_DEPTH = 15

    def read(self, entities: List[List["Recording"]], depth=0):
        total_available = sum([len(e) for e in entities])

        # prepare the weights
        total = sum(self.weights)
        summed = []
        acc = 0
        for i in self.weights:
            acc += i
            summed.append(acc)

        # Ensure seed artists are the first tracks -- doing this for all recording elements work in this case.
        recordings: List["Recording"] = []
        new_entities: List[List["Recording"]] = []

        for element in entities:
            new_entities.append([])
            try:
                recordings.append(element.pop(0))
            except IndexError:
                pass

        # This still allows sequential tracks to be from the same artists. I'll wait for feedback to see if this
        # is a problem.
        artist_counts: Dict[str, int] = defaultdict(int)
        dedup_set = set()

        while True:
            r = randint(0, total)
            for i, s in enumerate(summed):
                if r < s:
                    while True:
                        if len(entities[i]) > 0:
                            rec = entities[i].pop(0)
                            if rec.mbid in dedup_set:
                                total_available -= 1
                                continue
                            if (
                                self.max_artist_occurrence is not None
                                and artist_counts[rec.artist_credit.artist_credit_id]
                                == self.max_artist_occurrence
                            ):
                                new_entities[i].append(rec)
                                total_available -= 1
                                continue

                            recordings.append(rec)
                            dedup_set.add(rec.mbid)
                            artist_counts[rec.artist_credit.artist_credit_id] += 1
                        break

            if (
                len(recordings) >= self.max_num_recordings
                or len(recordings) == total_available
            ):
                break

        if len(recordings) < self.max_num_recordings and depth < self.MAX_DEPTH:
            new_weights: List[int] = []

            idx = 0

            while idx < len(new_entities):
                if new_entities[idx]:
                    new_weights.append(self.weights[idx])
                    idx += 1
                else:
                    self.weights.pop(idx)
                    new_entities.pop(idx)

            if new_entities:
                nested = self.read(new_entities, depth=depth + 1)
                return recordings + nested

        return recordings
