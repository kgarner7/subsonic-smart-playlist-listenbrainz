from typing import Dict, List

from troi.content_resolver.model.recording import Recording


__all__ = ["FuzzyIndex"]


class FuzzyIndex:
    """
    The original Troi Fuzzy Index is based off of matches. Since everything is exact, we
    can cheat this and just return the ids
    """

    def build(self, artist_recording_data):
        """
        Builds a new index and saves it to disk and keeps it in ram as well.
        """
        pass

    def search(self, query_data: List[dict]):
        """
        Everything _should_ be resolved, but some may be missing. Somehow
        """
        missing_ids = [
            item["recording_mbid"] for item in query_data if "recording_id" not in item
        ]

        missing_dict: Dict[str, int] = {}

        if missing_ids:
            resolved_missing = (
                Recording.select(Recording.id, Recording.recording_mbid)
                .where(Recording.recording_mbid.in_(missing_ids))
                .tuples()
            )

            for id, mbid in resolved_missing:
                missing_dict[mbid] = id

        output = [
            {
                "confidence": 1,
                "recording_id": (
                    recording["recording_id"]
                    if "recording_id" in recording
                    else missing_dict[recording["recording_mbid"]]
                ),
            }
            for recording in query_data
            if "recording_id" in recording
            or recording["recording_mbid"] in missing_dict
        ]
        return output
