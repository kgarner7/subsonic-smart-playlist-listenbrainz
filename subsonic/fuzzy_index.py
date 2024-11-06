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

    def search(self, query_data):
        """
        Since everything is resolved, just return the recording id
        """

        output = [
            {"confidence": 1, "recording_id": recording["recording_id"]}
            for recording in query_data
        ]
        return output
