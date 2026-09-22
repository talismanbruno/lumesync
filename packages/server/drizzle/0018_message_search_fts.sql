CREATE VIRTUAL TABLE messages_fts USING fts5(content, tokenize='trigram');
--> statement-breakpoint
INSERT INTO messages_fts(rowid, content) SELECT rowid, content FROM messages;
--> statement-breakpoint
CREATE TRIGGER messages_fts_insert AFTER INSERT ON messages BEGIN
  INSERT INTO messages_fts(rowid, content) VALUES (new.rowid, new.content);
END;
--> statement-breakpoint
CREATE TRIGGER messages_fts_update AFTER UPDATE OF content ON messages BEGIN
  UPDATE messages_fts SET content = new.content WHERE rowid = new.rowid;
END;
--> statement-breakpoint
CREATE TRIGGER messages_fts_delete AFTER DELETE ON messages BEGIN
  DELETE FROM messages_fts WHERE rowid = old.rowid;
END;
--> statement-breakpoint
CREATE VIRTUAL TABLE dm_messages_fts USING fts5(content, tokenize='trigram');
--> statement-breakpoint
INSERT INTO dm_messages_fts(rowid, content) SELECT rowid, content FROM dm_messages;
--> statement-breakpoint
CREATE TRIGGER dm_messages_fts_insert AFTER INSERT ON dm_messages BEGIN
  INSERT INTO dm_messages_fts(rowid, content) VALUES (new.rowid, new.content);
END;
--> statement-breakpoint
CREATE TRIGGER dm_messages_fts_update AFTER UPDATE OF content ON dm_messages BEGIN
  UPDATE dm_messages_fts SET content = new.content WHERE rowid = new.rowid;
END;
--> statement-breakpoint
CREATE TRIGGER dm_messages_fts_delete AFTER DELETE ON dm_messages BEGIN
  DELETE FROM dm_messages_fts WHERE rowid = old.rowid;
END;
