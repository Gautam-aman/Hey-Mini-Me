import { DatabaseSync } from "node:sqlite";
import { randomUUID, createHash } from "node:crypto";
export class Store {
  constructor(path) {
    this.db = new DatabaseSync(path);
    this.db.exec(`PRAGMA foreign_keys=ON;
 CREATE TABLE IF NOT EXISTS migrations(name TEXT PRIMARY KEY);
 CREATE TABLE IF NOT EXISTS conversations(id TEXT PRIMARY KEY,title TEXT NOT NULL,created_at TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS turns(id TEXT PRIMARY KEY,conversation_id TEXT REFERENCES conversations(id) ON DELETE CASCADE,role TEXT,content TEXT,created_at TEXT,metadata TEXT);
 CREATE INDEX IF NOT EXISTS turns_time ON turns(conversation_id,created_at);
 CREATE VIRTUAL TABLE IF NOT EXISTS turn_search USING fts5(content,turn_id UNINDEXED,conversation_id UNINDEXED);
 CREATE TABLE IF NOT EXISTS observations(id TEXT PRIMARY KEY,turn_id TEXT REFERENCES turns(id) ON DELETE CASCADE,payload TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS episodes(turn_id TEXT PRIMARY KEY REFERENCES turns(id) ON DELETE CASCADE,topic TEXT,entities TEXT,message_ids TEXT);
 CREATE TABLE IF NOT EXISTS decisions(turn_id TEXT PRIMARY KEY REFERENCES turns(id) ON DELETE CASCADE,entities TEXT NOT NULL,original_messages TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS claims(id TEXT PRIMARY KEY,turn_id TEXT REFERENCES turns(id) ON DELETE CASCADE,payload TEXT);
 CREATE TABLE IF NOT EXISTS runs(id TEXT PRIMARY KEY,conversation_id TEXT REFERENCES conversations(id) ON DELETE CASCADE,payload TEXT NOT NULL);
 `);
    // Import the first prototype once; retain originals until the user deletes the imported conversation.
    if (
      this.db
        .prepare(
          "SELECT name FROM sqlite_master WHERE type='table' AND name='messages'",
        )
        .get() &&
      !this.db
        .prepare("SELECT name FROM migrations WHERE name=?")
        .get("legacy-import")
    ) {
      const old = this.db
        .prepare("SELECT * FROM messages ORDER BY rowid")
        .all();
      if (old.length) {
        this.db.exec("BEGIN");
        try {
          this.db
            .prepare("INSERT INTO conversations VALUES(?,?,?)")
            .run("legacy", "Imported conversation", old[0].created_at);
          for (const m of old) {
            this.db
              .prepare("INSERT INTO turns VALUES(?,?,?,?,?,?)")
              .run(m.id, "legacy", m.role, m.content, m.created_at, "{}");
            this.db
              .prepare("INSERT INTO turn_search VALUES(?,?,?)")
              .run(m.content, m.id, "legacy");
            if (
              this.db
                .prepare(
                  "SELECT name FROM sqlite_master WHERE type='table' AND name='evidence'",
                )
                .get()
            )
              for (const source of this.db
                .prepare("SELECT * FROM evidence WHERE answer_id=?")
                .all(m.id))
                this.db
                  .prepare("INSERT INTO observations VALUES(?,?,?)")
                  .run(
                    randomUUID(),
                    m.id,
                    JSON.stringify({ ...source, id: source.id }),
                  );
          }
          this.db
            .prepare("INSERT INTO migrations VALUES(?)")
            .run("legacy-import");
          this.db.exec("COMMIT");
        } catch (e) {
          this.db.exec("ROLLBACK");
          throw e;
        }
      }
    }
  }
  list() {
    return this.db
      .prepare("SELECT * FROM conversations ORDER BY created_at DESC")
      .all();
  }
  create(title = "New conversation") {
    const id = randomUUID();
    this.db
      .prepare("INSERT INTO conversations VALUES(?,?,?)")
      .run(id, title.slice(0, 80), new Date().toISOString());
    return id;
  }
  exists(id) {
    return !!this.db.prepare("SELECT id FROM conversations WHERE id=?").get(id);
  }
  messages(id) {
    return this.db
      .prepare("SELECT * FROM turns WHERE conversation_id=? ORDER BY rowid")
      .all(id)
      .map((m) => ({ ...m, metadata: JSON.parse(m.metadata || "{}") }));
  }
  add(id, role, content, metadata = {}, sources = []) {
    const turnId = randomUUID();
    this.db.exec("BEGIN");
    try {
      this.db
        .prepare("INSERT INTO turns VALUES(?,?,?,?,?,?)")
        .run(
          turnId,
          id,
          role,
          content,
          new Date().toISOString(),
          JSON.stringify(metadata),
        );
      this.db
        .prepare("INSERT INTO turn_search VALUES(?,?,?)")
        .run(content, turnId, id);
      for (const source of sources)
        this.db.prepare("INSERT INTO observations VALUES(?,?,?)").run(
          randomUUID(),
          turnId,
          JSON.stringify({
            ...source,
            hash: createHash("sha256")
              .update(source.content || "")
              .digest("hex"),
          }),
        );
      if (metadata.plan)
        this.db
          .prepare("INSERT INTO episodes VALUES(?,?,?,?)")
          .run(
            turnId,
            metadata.plan.intent,
            JSON.stringify(metadata.plan.entities || []),
            JSON.stringify(metadata.plan.baselineMessageIds || []),
          );
      if (metadata.plan?.entities?.length)
        this.db
          .prepare("INSERT INTO decisions VALUES(?,?,?)")
          .run(
            turnId,
            JSON.stringify(metadata.plan.entities),
            JSON.stringify(metadata.plan.baselineMessageIds || []),
          );
      for (const claim of metadata.claims || [])
        this.db
          .prepare("INSERT INTO claims VALUES(?,?,?)")
          .run(randomUUID(), turnId, JSON.stringify(claim));
      this.db.exec("COMMIT");
      return turnId;
    } catch (e) {
      this.db.exec("ROLLBACK");
      throw e;
    }
  }
  evidence(id) {
    return this.db
      .prepare("SELECT payload FROM observations WHERE turn_id=?")
      .all(id)
      .map((x) => JSON.parse(x.payload));
  }
  search(id, query) {
    const terms = (query.match(/[\p{L}\p{N}]+/gu) || [])
      .filter((x) => x.length > 3)
      .slice(0, 12)
      .map((x) => '"' + x + '"')
      .join(" OR ");
    if (!terms) return [];
    return this.db
      .prepare(
        "SELECT turn_id FROM turn_search WHERE turn_search MATCH ? AND conversation_id=? ORDER BY rank LIMIT 12",
      )
      .all(terms, id)
      .map((x) => x.turn_id);
  }
  delete(id) {
    this.db.exec("BEGIN");
    try {
      this.db
        .prepare("DELETE FROM turn_search WHERE conversation_id=?")
        .run(id);
      this.db.prepare("DELETE FROM conversations WHERE id=?").run(id);
      if (id === "legacy") {
        this.db.exec("DELETE FROM messages");
        if (
          this.db
            .prepare(
              "SELECT name FROM sqlite_master WHERE type='table' AND name='evidence'",
            )
            .get()
        )
          this.db.exec("DELETE FROM evidence");
      }
      this.db.exec("COMMIT");
    } catch (e) {
      this.db.exec("ROLLBACK");
      throw e;
    }
  }
  record(id, payload) {
    this.db
      .prepare("INSERT INTO runs VALUES(?,?,?)")
      .run(randomUUID(), id, JSON.stringify(payload));
  }
  close() {
    this.db.close();
  }
}
