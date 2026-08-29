// PURE id generation.
//
// `crypto.randomUUID` only exists in a *secure context*: HTTPS, or http://localhost.
// A self-hosted instance served over plain HTTP on a LAN address (which is exactly
// what docs/self-hosting.md describes, e.g. http://192.168.1.10) is NOT a secure
// context, so `crypto.randomUUID` is undefined there and every id-generating action
// throws "crypto.randomUUID is not a function".
//
// `crypto.getRandomValues` has no such restriction, so we derive a v4 UUID from it
// whenever `randomUUID` is missing. Same shape, same randomness source.

/** A v4 UUID. Works in secure and insecure contexts alike. */
export function newId(): string {
  const c = globalThis.crypto;
  if (typeof c?.randomUUID === "function") return c.randomUUID();

  const bytes = new Uint8Array(16);
  c.getRandomValues(bytes);
  bytes[6] = (bytes[6] & 0x0f) | 0x40; // version 4
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // variant 10xx

  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
