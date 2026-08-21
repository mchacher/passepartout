// Storage for the Passepartout server (spec 024): SQLite holds the project documents (as
// opaque JSON plus a few indexed columns) and metadata; image blobs live as files under
// <dataDir>/blobs. Mirrors the bundle model (spec 021) so import/export stay compatible.

import Database from "better-sqlite3";
import { mkdirSync, existsSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";

export interface ProjectMeta {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
}

/** A doc is stored opaque; only these top-level fields are read out for the columns. */
interface DocHead {
  id: string;
  name?: string;
  createdAt?: number;
  updatedAt?: number;
  photos?: { id: string }[];
}

// Ids come from URLs and doc bodies; only accept safe filename tokens (UUIDs qualify), so a
// blob path can never escape the blob directory.
export function isSafeId(id: string): boolean {
  return typeof id === "string" && /^[A-Za-z0-9_-]{1,64}$/.test(id);
}

export class Store {
  private db: Database.Database;
  private blobDir: string;

  constructor(dbPath: string, dataDir: string) {
    if (dbPath !== ":memory:") mkdirSync(dirname(dbPath), { recursive: true });
    this.db = new Database(dbPath);
    this.db.pragma("journal_mode = WAL");
    this.db.exec(
      `CREATE TABLE IF NOT EXISTS projects (
         id TEXT PRIMARY KEY,
         name TEXT NOT NULL DEFAULT '',
         doc TEXT NOT NULL,
         createdAt INTEGER NOT NULL,
         updatedAt INTEGER NOT NULL
       );
       CREATE TABLE IF NOT EXISTS images (
         id TEXT PRIMARY KEY,
         mime TEXT NOT NULL DEFAULT 'application/octet-stream'
       );`,
    );
    this.blobDir = join(dataDir, "blobs");
    mkdirSync(this.blobDir, { recursive: true });
  }

  listProjects(): ProjectMeta[] {
    return this.db
      .prepare("SELECT id, name, createdAt, updatedAt FROM projects ORDER BY updatedAt DESC")
      .all() as ProjectMeta[];
  }

  /** The raw doc JSON string, or undefined. Kept as text so we never reserialize it. */
  getDoc(id: string): string | undefined {
    const row = this.db.prepare("SELECT doc FROM projects WHERE id = ?").get(id) as { doc: string } | undefined;
    return row?.doc;
  }

  putDoc(doc: DocHead): void {
    const now = Date.now();
    this.db
      .prepare(
        `INSERT INTO projects (id, name, doc, createdAt, updatedAt)
         VALUES (@id, @name, @doc, @createdAt, @updatedAt)
         ON CONFLICT(id) DO UPDATE SET name = @name, doc = @doc, updatedAt = @updatedAt`,
      )
      .run({
        id: doc.id,
        name: doc.name ?? "",
        doc: JSON.stringify(doc),
        createdAt: doc.createdAt ?? now,
        updatedAt: doc.updatedAt ?? now,
      });
  }

  deleteProject(id: string): void {
    const doc = this.getDoc(id);
    this.db.prepare("DELETE FROM projects WHERE id = ?").run(id);
    if (doc) {
      try {
        const parsed = JSON.parse(doc) as DocHead;
        for (const p of parsed.photos ?? []) this.deleteImage(p.id);
      } catch {
        /* a corrupt doc: the row is gone, leave any orphan blobs rather than throw */
      }
    }
  }

  private blobPath(id: string): string {
    return join(this.blobDir, id);
  }

  putImage(id: string, bytes: Buffer, mime: string): void {
    writeFileSync(this.blobPath(id), bytes);
    this.db
      .prepare("INSERT INTO images (id, mime) VALUES (?, ?) ON CONFLICT(id) DO UPDATE SET mime = excluded.mime")
      .run(id, mime);
  }

  getImage(id: string): { bytes: Buffer; mime: string } | undefined {
    const p = this.blobPath(id);
    if (!existsSync(p)) return undefined;
    const row = this.db.prepare("SELECT mime FROM images WHERE id = ?").get(id) as { mime: string } | undefined;
    return { bytes: readFileSync(p), mime: row?.mime ?? "application/octet-stream" };
  }

  deleteImage(id: string): void {
    try {
      rmSync(this.blobPath(id), { force: true });
    } catch {
      /* ignore */
    }
    this.db.prepare("DELETE FROM images WHERE id = ?").run(id);
  }
}
