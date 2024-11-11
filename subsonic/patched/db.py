from playhouse.sqlite_ext import SqliteExtDatabase

PRAGMAS = (
    ("foreign_keys", 1),
    ("journal_mode", "WAL"),
)

db = SqliteExtDatabase(None, pragmas=PRAGMAS)


def setup_db(db_file):
    global db
    db.init(db_file)
