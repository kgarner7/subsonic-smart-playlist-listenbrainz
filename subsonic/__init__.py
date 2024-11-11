from .patched.monkeypatch import monkeypatch

monkeypatch("troi.content_resolver.model.database", "subsonic/patched/db.py")
