import { describe, it, expect } from "vitest";
import bcrypt from "bcryptjs";
import { hashPassword, verifyPassword, needsRehash } from "./auth";

const PASSWORD = "correct horse battery";

describe("hashPassword / verifyPassword", () => {
  it("round-trips a password and rejects a wrong one", async () => {
    const hash = await hashPassword(PASSWORD);
    expect(await verifyPassword(PASSWORD, hash)).toBe(true);
    expect(await verifyPassword("wrong password", hash)).toBe(false);
    expect(await verifyPassword("", hash)).toBe(false);
  });

  it("salts, so the same password hashes differently every time", async () => {
    const a = await hashPassword(PASSWORD);
    const b = await hashPassword(PASSWORD);
    expect(a).not.toBe(b);
    expect(await verifyPassword(PASSWORD, b)).toBe(true);
  });

  it("stores its parameters, so the hash says how to verify itself", async () => {
    const [prefix, n, r, p, salt, key] = (await hashPassword(PASSWORD)).split("$");
    expect(prefix).toBe("scrypt");
    expect(Number(n)).toBe(2 ** 15);
    expect(Number(r)).toBe(8);
    expect(Number(p)).toBe(1);
    expect(Buffer.from(salt, "base64")).toHaveLength(16);
    expect(Buffer.from(key, "base64")).toHaveLength(64);
  });

  it("verifies a hash made with a different work factor", async () => {
    // Rewrite the stored N to a weaker one and check the hash still verifies: raising the work
    // factor later must not lock anyone out.
    const hash = await hashPassword(PASSWORD);
    const weaker = hash.replace(`scrypt$${2 ** 15}$`, "scrypt$16384$");
    expect(await verifyPassword(PASSWORD, weaker)).toBe(false); // a different N is a different key
    expect(needsRehash(weaker)).toBe(true); // and it is flagged for rewriting
  });

  it("never throws on a malformed or unknown hash", async () => {
    for (const bad of ["", "nonsense", "scrypt$", "scrypt$a$b$c$d$e", "argon2$x$y", "$3$weird"]) {
      expect(await verifyPassword(PASSWORD, bad), bad).toBe(false);
    }
  });
});

describe("legacy bcrypt hashes (issue 80 migration)", () => {
  it("still verifies an account created before the move to scrypt", async () => {
    const legacy = bcrypt.hashSync(PASSWORD, 10);
    expect(await verifyPassword(PASSWORD, legacy)).toBe(true);
    expect(await verifyPassword("wrong password", legacy)).toBe(false);
  });

  it("flags a bcrypt hash for rewriting and a current scrypt one as fine", async () => {
    expect(needsRehash(bcrypt.hashSync(PASSWORD, 10))).toBe(true);
    expect(needsRehash(await hashPassword(PASSWORD))).toBe(false);
    expect(needsRehash("nonsense")).toBe(true);
  });
});

describe("the event loop stays free", () => {
  // Deterministic rather than timed: a macrotask scheduled right after the call must run
  // BEFORE the hash resolves. With the old synchronous bcryptjs the work finished inside the
  // call, so the promise was already settled and its continuation won the race instead.
  it("lets other work run while a password is verified", async () => {
    const hash = await hashPassword(PASSWORD);
    const order: string[] = [];
    const verifying = verifyPassword(PASSWORD, hash).then((ok) => {
      order.push("verified");
      return ok;
    });
    setImmediate(() => order.push("other request"));
    expect(await verifying).toBe(true);
    expect(order[0]).toBe("other request");
  });

  it("stays free under several verifications at once", async () => {
    const hash = await hashPassword(PASSWORD);
    let ticks = 0;
    const timer = setInterval(() => ticks++, 2);
    await Promise.all(Array.from({ length: 5 }, () => verifyPassword(PASSWORD, hash)));
    clearInterval(timer);
    // Five verifications take a few hundred ms; a blocked loop would tick a handful of times.
    expect(ticks).toBeGreaterThan(20);
  });
});
