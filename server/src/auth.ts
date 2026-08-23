// Password hashing (spec 024, issue 80).
//
// Passwords are hashed with scrypt from node's standard library, run through its ASYNCHRONOUS
// api so the work happens on the libuv thread pool and the event loop stays free to serve
// everyone else. The previous implementation used bcryptjs in synchronous mode: pure
// JavaScript on the one thread that also answers every request, which stalled the whole
// instance for about 70 ms per verification, and for as long as the flood lasted under abuse.
// bcryptjs's own async api does not fix that (its chunking is coarse and concurrent calls
// still interleave on that one thread), hence the move.
//
// Existing accounts keep their `$2...` bcrypt hash and are still verified with bcryptjs; the
// hash is rewritten to scrypt on the next successful sign-in (see `needsRehash`), so everyone
// migrates without noticing and the bcryptjs dependency can go once no `$2` hash is left.

import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import bcrypt from "bcryptjs";

const scrypt = promisify(scryptCallback) as (
  password: string,
  salt: Buffer,
  keylen: number,
  options: { N: number; r: number; p: number; maxmem: number },
) => Promise<Buffer>;

// OWASP's scrypt baseline. N is the work factor; 2^15 costs about 80 ms on a laptop and needs
// 128 * N * r = 32 MB, which is why maxmem has to be raised above node's 32 MB default.
const N = 2 ** 15;
const R = 8;
const P = 1;
const MAXMEM = 64 * 1024 * 1024;
const KEYLEN = 64;
const SALT_BYTES = 16;

/** Marks our own format, so a stored hash says how to verify itself. */
const PREFIX = "scrypt";

/** A bcrypt hash from before issue 80. Every bcrypt variant starts with `$2`. */
const isBcrypt = (hash: string): boolean => hash.startsWith("$2");

/**
 * Hash a password. The result carries its own parameters, so raising the work factor later
 * does not invalidate what is already stored: `scrypt$N$r$p$salt$key`, salt and key in base64.
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_BYTES);
  const key = await scrypt(password, salt, KEYLEN, { N, r: R, p: P, maxmem: MAXMEM });
  return [PREFIX, N, R, P, salt.toString("base64"), key.toString("base64")].join("$");
}

/**
 * Verify a password against a stored hash, in either format. Never throws: a malformed or
 * unknown hash is simply not a match.
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  try {
    if (isBcrypt(hash)) return await bcrypt.compare(password, hash);

    const [prefix, n, r, p, saltB64, keyB64] = hash.split("$");
    if (prefix !== PREFIX) return false;
    const salt = Buffer.from(saltB64, "base64");
    const expected = Buffer.from(keyB64, "base64");
    if (salt.length === 0 || expected.length === 0) return false;

    // Read the parameters back from the hash, so a password stored under older settings still
    // verifies after they change.
    const actual = await scrypt(password, salt, expected.length, {
      N: Number(n),
      r: Number(r),
      p: Number(p),
      maxmem: MAXMEM,
    });
    return actual.length === expected.length && timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

/**
 * Whether a stored hash should be rewritten after a successful sign-in: a legacy bcrypt one,
 * or one made with a weaker work factor than the current setting.
 */
export function needsRehash(hash: string): boolean {
  if (isBcrypt(hash)) return true;
  const [prefix, n, r, p] = hash.split("$");
  if (prefix !== PREFIX) return true;
  return Number(n) < N || Number(r) !== R || Number(p) !== P;
}
