from typing import Dict, Optional

from hashlib import md5
from os import environ

from libsonic import Connection

SUBSONIC_BASE_URL = environ["SUBSONIC_URL"]
SUBSONIC_PORT = environ["SUBSONIC_PORT"]
SUBSONIC_PATH = environ.get("SUBSONIC_PATH", "/rest")
ENABLE_SELF_SIGNED = environ.get("SUBSONIC_SELF_SIGNED", False)
LEGACY_AUTH = environ.get("SUBSONIC_LEGACY", False)

__all__ = ["CustomConnection"]


class CustomConnection(Connection):
    """
    This represents a connection which does not store the actual
    password, but rather stores the encoded password (reversible)
    or salt/token
    """

    def __init__(
        self,
        credentials: Optional[Dict[str, str]] = None,
        username: Optional[str] = None,
        password: Optional[str] = None,
    ):
        if credentials:
            self._credentials = credentials
        elif username != None and password != None:
            if LEGACY_AUTH:
                self._credentials = {
                    "u": username,
                    "p": "enc:%s" % self._hexEnc(password),
                }
            else:
                salt = self._getSalt()
                token = md5((password + salt).encode("utf-8")).hexdigest()
                self._credentials = {"s": salt, "t": token, "u": username}
        else:
            raise Exception("Must provide credentials or username/password")

        super().__init__(
            SUBSONIC_BASE_URL,
            username="notarealusername",
            password="notarealpassword",
            port=SUBSONIC_PORT,
            serverPath=SUBSONIC_PATH,
            appName="troi-lbz-generator",
            insecure=ENABLE_SELF_SIGNED,
            legacyAuth=LEGACY_AUTH,
        )

    def _getBaseQdict(self):
        return {
            "f": "json",
            "v": self._apiVersion,
            "c": self._appName,
            **self._credentials,
        }
