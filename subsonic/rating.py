def create_rating_table(db):
    create_table = """
CREATE TABLE IF NOT EXISTS rating(
    recording_id TEXT NOT NULL,
    recording_type INTEGER NOT NULL,
    username TEXT NOT NULL,
    rating INTEGER,
    PRIMARY KEY(recording_id, username, recording_type),
    FOREIGN KEY(recording_id, recording_type) 
        REFERENCES recording(file_id, file_id_type) 
        ON UPDATE CASCADE ON DELETE CASCADE
);
"""

    create_index = """
CREATE UNIQUE INDEX IF NOT EXISTS "rating_reference" 
ON "rating" ("recording_id", "username", "recording_type");
"""
    with db.atomic():
        db.execute_sql(create_table)
        db.execute_sql(create_index)
