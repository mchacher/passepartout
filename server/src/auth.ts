// Single-password auth (spec 024). The password is stored only as a bcrypt hash; requests
// carry a signed httpOnly session cookie proving the password was known. No accounts.

import bcrypt from "bcryptjs";

export function hashPassword(password: string): string {
  return bcrypt.hashSync(password, 10);
}

export function verifyPassword(password: string, hash: string): boolean {
  try {
    return bcrypt.compareSync(password, hash);
  } catch {
    return false;
  }
}
