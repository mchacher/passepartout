// Entry point for the Passepartout server (spec 024). Reads its config from the environment,
// opens the store under DATA_DIR, and serves the API on PORT.
//
// Env:
//   SESSION_SECRET  secret that signs the session cookie (set it to keep sessions across restarts)
//   DATA_DIR        where app.db and blobs/ live (default /data)
//   PORT            listen port (default 3000)
//   TRUST_PROXY     'off' when no reverse proxy sits in front (default: trust one hop)
//   COOKIE_SECURE   "true" to mark the cookie Secure (behind HTTPS)
//   GITHUB_TOKEN    optional; read the latest release for the update check (spec 025)
//
// User accounts (spec 026) are created in-app: a fresh instance shows a first-run setup to
// choose the first username + password. There is no shared password env anymore.

import { randomBytes } from "node:crypto";
import { buildApp } from "./app";
import { Store } from "./db";

const DATA_DIR = process.env.DATA_DIR ?? "/data";
const PORT = Number(process.env.PORT ?? 3000);
const cookieSecure = process.env.COOKIE_SECURE === "true";

let sessionSecret = process.env.SESSION_SECRET ?? "";
if (!sessionSecret) {
  sessionSecret = randomBytes(32).toString("hex");
  console.warn("passepartout-server: SESSION_SECRET not set; using an ephemeral one (sessions reset on restart)");
}

const store = new Store(`${DATA_DIR}/app.db`, DATA_DIR);
// TRUST_PROXY=off when the API is exposed with no reverse proxy in front: the rate limit then
// keys on the socket address, which a client cannot forge (issue 78).
const trustProxy = process.env.TRUST_PROXY !== "off";
const app = await buildApp({ store, sessionSecret, cookieSecure, trustProxy, githubToken: process.env.GITHUB_TOKEN });

app
  .listen({ host: "0.0.0.0", port: PORT })
  .then(() => console.log(`passepartout-server listening on :${PORT} (data: ${DATA_DIR})`))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
