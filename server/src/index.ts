// Entry point for the Passepartout server (spec 024). Reads its config from the environment,
// opens the store under DATA_DIR, and serves the API on PORT.
//
// Env:
//   PASSEPARTOUT_PASSWORD       the household password (hashed on boot), or
//   PASSEPARTOUT_PASSWORD_HASH  a precomputed bcrypt hash (preferred; the plain one is never stored)
//   SESSION_SECRET              secret that signs the session cookie (set it to keep sessions across restarts)
//   DATA_DIR                    where app.db and blobs/ live (default /data)
//   PORT                        listen port (default 3000)
//   COOKIE_SECURE               "true" to mark the cookie Secure (behind HTTPS)

import { randomBytes } from "node:crypto";
import { buildApp } from "./app";
import { Store } from "./db";
import { hashPassword } from "./auth";

const DATA_DIR = process.env.DATA_DIR ?? "/data";
const PORT = Number(process.env.PORT ?? 3000);
const cookieSecure = process.env.COOKIE_SECURE === "true";

let passwordHash = process.env.PASSEPARTOUT_PASSWORD_HASH ?? "";
if (!passwordHash) {
  const pw = process.env.PASSEPARTOUT_PASSWORD;
  if (!pw) {
    console.error("passepartout-server: set PASSEPARTOUT_PASSWORD or PASSEPARTOUT_PASSWORD_HASH");
    process.exit(1);
  }
  passwordHash = hashPassword(pw);
}

let sessionSecret = process.env.SESSION_SECRET ?? "";
if (!sessionSecret) {
  sessionSecret = randomBytes(32).toString("hex");
  console.warn("passepartout-server: SESSION_SECRET not set; using an ephemeral one (sessions reset on restart)");
}

const store = new Store(`${DATA_DIR}/app.db`, DATA_DIR);
const app = buildApp({ store, passwordHash, sessionSecret, cookieSecure, githubToken: process.env.GITHUB_TOKEN });

app
  .listen({ host: "0.0.0.0", port: PORT })
  .then(() => console.log(`passepartout-server listening on :${PORT} (data: ${DATA_DIR})`))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
