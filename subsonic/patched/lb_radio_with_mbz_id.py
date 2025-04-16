from time import sleep

from requests import Session
from uuid import UUID

from troi.patches import lb_radio

session = Session()
session.headers.update({'User-Agent': 'Troi Subsonic Generator/1'})

class LBRadioNamedLookup(lb_radio.LBRadioPatch):
    def lookup_artist(self, artist_name):
        """ Fetch artist names for validation purposes """

        if isinstance(artist_name, UUID):
            return self.lookup_artist_from_mbid(artist_name)

        err_msg = f"Artist {artist_name} could not be looked up. Please use exact spelling."

        while True:
            r = session.get( f"https://musicbrainz.org/ws/2/artist?query={quote(artist_name)}&fmt=json")
            if r.status_code == 404:
                raise RuntimeError(err_msg)

            if r.status_code == 429:
                sleep(2)
                continue

            if r.status_code != 200:
                raise RuntimeError( f"Could not resolve artist name {artist_name}. Error {r.status_code} {r.text}")

            break

        data = r.json()
        try:
            fetched_name = data["artists"][0]["name"]
            mbid = data["artists"][0]["id"]
        except (IndexError, KeyError):
            raise RuntimeError(err_msg)

        if fetched_name.lower() == artist_name.lower():
            return fetched_name, mbid

        raise RuntimeError(err_msg)

    def lookup_artist_from_mbid(self, artist_mbid):
        """ Fetch artist names for validation purposes """

        while True:
            r = session.get(f"https://musicbrainz.org/ws/2/artist/%s?fmt=json" % str(artist_mbid))
            if r.status_code == 404:
                raise RuntimeError(f"Could not resolve artist mbid {artist_mbid}. Error {r.status_code} {r.text}")

            if r.status_code in (429, 503):
                sleep(2)
                continue

            if r.status_code != 200:
                raise RuntimeError(f"Could not resolve artist name {artist_mbid}. Error {r.status_code} {r.text}")

            break

        return r.json()["name"], artist_mbid
