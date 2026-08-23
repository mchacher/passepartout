// Storage for the Passepartout server (spec 024): SQLite holds the project documents (as
// opaque JSON plus a few indexed columns) and metadata; image blobs live as files under
// <dataDir>/blobs. Mirrors the bundle model (spec 021) so import/export stay compatible.

import Database from "better-sqlite3";
import { mkdirSync, existsSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { dirname, join, resolve, sep } from "node:path";

export interface ProjectMeta {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
}

/** A user account, public view (no hash). */
export interface UserMeta {
  id: string;
  username: string;
  createdAt: number;
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
       );
       CREATE TABLE IF NOT EXISTS users (
         id TEXT PRIMARY KEY,
         username TEXT NOT NULL UNIQUE COLLATE NOCASE,
         passwordHash TEXT NOT NULL,
         createdAt INTEGER NOT NULL
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
    // The routes reject unsafe ids before calling in, but the path is BUILT here, so the guard
    // belongs here too: a filename-token check, then a containment check on the resolved path.
    // The second one is what actually proves the result cannot leave the blob directory.
    if (!isSafeId(id)) throw new Error(`unsafe image id: ${id}`);
    const root = resolve(this.blobDir);
    const p = resolve(root, id);
    if (p !== join(root, id) || !p.startsWith(root + sep)) throw new Error(`unsafe image id: ${id}`);
    return p;
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

  // --- Users (spec 026) ---

  countUsers(): number {
    return (this.db.prepare("SELECT COUNT(*) AS n FROM users").get() as { n: number }).n;
  }

  /** Insert a user. Throws on a duplicate username (UNIQUE COLLATE NOCASE). */
  createUser(id: string, username: string, passwordHash: string, createdAt: number): void {
    this.db
      .prepare("INSERT INTO users (id, username, passwordHash, createdAt) VALUES (?, ?, ?, ?)")
      .run(id, username, passwordHash, createdAt);
  }

  findUserByName(username: string): { id: string; username: string; passwordHash: string } | undefined {
    return this.db
      .prepare("SELECT id, username, passwordHash FROM users WHERE username = ? COLLATE NOCASE")
      .get(username) as { id: string; username: string; passwordHash: string } | undefined;
  }

  getUser(id: string): UserMeta | undefined {
    return this.db.prepare("SELECT id, username, createdAt FROM users WHERE id = ?").get(id) as UserMeta | undefined;
  }

  getUserHash(id: string): string | undefined {
    const row = this.db.prepare("SELECT passwordHash FROM users WHERE id = ?").get(id) as { passwordHash: string } | undefined;
    return row?.passwordHash;
  }

  listUsers(): UserMeta[] {
    return this.db.prepare("SELECT id, username, createdAt FROM users ORDER BY createdAt ASC").all() as UserMeta[];
  }

  deleteUser(id: string): void {
    this.db.prepare("DELETE FROM users WHERE id = ?").run(id);
  }

  updateUserPassword(id: string, passwordHash: string): void {
    this.db.prepare("UPDATE users SET passwordHash = ? WHERE id = ?").run(passwordHash, id);
  }
}
