# 026 - Basic user management + first-run setup

## Context

Server mode (spec 024) protects the instance with a single shared password from an env var.
That is fine for one household member but not for a family: no per-person login, and the
password lives in the compose file. This replaces it with basic **user accounts**, following
Sowel's model but simplified.

Decisions (with the user, 2026-08-21):

- **Multiple users, all equal.** No roles / rights to manage yet - every user has the same
  privileges (including managing users).
- **First-run setup**, like Sowel: on a fresh instance with no users, the app invites the
  operator to choose a **username + password** to create the first account.
- **Albums are shared.** Users are for access (who can log in), not data separation - everyone
  works on the same albums (a household photo studio).

Since spec 024 has not been released, this cleanly **replaces** the single-password auth (no
migration burden). Local (static) mode is unaffected - it has no accounts.

## Goal

A fresh server-mode instance asks the operator to create the first account, then anyone with an
account logs in with their username + password. Users can add and remove accounts and change
their own password, from the app.

## Non-goals

- **No roles / permissions** (all users equal).
- **No per-user albums** (shared data).
- No email, password reset by email, or MFA (Sowel has MFA; out of scope here).
- No change to the layout engine or album data; local mode is untouched.

## Requirements

1. **Users store** (server): a `users` table (`id`, `username` unique/case-insensitive,
   `passwordHash` bcrypt, `createdAt`). Passwords are only ever stored hashed; never logged.
2. **First-run setup**: when no user exists, every API call except the setup/status endpoints is
   refused with `setupRequired`. `POST /api/auth/setup` {username, password} creates the first
   user (only while none exist) and logs them in.
3. **Auth**: `POST /api/auth/login` {username, password} sets the signed httpOnly session cookie
   (now carrying the user id); `POST /api/auth/logout`; `GET /api/auth/me` -> the current user;
   `GET /api/auth/status` (open) -> `{ needsSetup, authed }` so the app can route to setup /
   login / app. A session is valid only while its user still exists.
4. **User management** (any logged-in user): `GET /api/users` (list: id, username, createdAt),
   `POST /api/users` {username, password} (create; 409 on a taken name), `DELETE /api/users/:id`
   (refuse deleting the last remaining user). `POST /api/account/password`
   {currentPassword, newPassword} changes one's own password.
5. **Frontend**: a **Setup** screen (first run) and a username+password **Login**; a small
   **Users** panel to list/add/remove accounts and change your own password; the current user is
   shown in the project menu with **Log out**.
6. **Config**: drop `PASSEPARTOUT_PASSWORD` (replaced by accounts). Keep `SESSION_SECRET`. Update
   compose + docs.
7. Basic validation: non-empty username, a minimum password length (>= 8), unique username.

## Architecture

```
Startup (server mode): GET /api/auth/status
  needsSetup -> Setup screen (create first account)
  else !authed -> Login (username + password)
  else -> app

Server (users table in the existing SQLite):
  POST /auth/setup   (only when 0 users)  -> create + session
  POST /auth/login   -> verify bcrypt -> session cookie = signed userId
  GET  /auth/me      -> { id, username }
  GET  /users, POST /users, DELETE /users/:id, POST /account/password
Session gate: signed cookie -> userId -> user must still exist.
```

- Server: new `server/src/users.ts` (Store methods: create/find/list/delete/count/updatePassword)
  on the existing DB; `auth.ts` keeps bcrypt; `app.ts` reworks the gate + endpoints.
- Frontend: `Setup.tsx` + reworked `Login.tsx` (username+password); a `UsersPanel`; the store
  gains `authStatus`/`currentUser`/`users` + `setup`/`login`/`logout`/`addUser`/`deleteUser`/
  `changePassword`. `PersistenceBackend.login` becomes `(username, password)`.

## Acceptance criteria

- [x] A fresh server instance shows a Setup screen; creating the first account logs in and opens
      the app. Re-running setup once a user exists is refused (409).
- [x] Login requires a valid username + password; wrong credentials are rejected; unauthenticated
      API calls (except status/setup) return 401.
- [x] A logged-in user can add another account, and the new account can log in and see the same
      albums (shared data).
- [x] A user can delete accounts but not the last remaining one; deleting a user invalidates its
      session.
- [x] A user can change their own password (checked against the current one).
- [x] Local (static) mode is unchanged - no accounts, no setup, no login.
- [x] Server tests cover setup/login/gate/users/password; `npm run validate` + server tests green.

## Edge cases

- **No users yet**: only `auth/status` and `auth/setup` work; everything else 401/403 with
  `setupRequired` so the app routes to Setup.
- **Duplicate username** (case-insensitive): create/setup returns 409.
- **Deleting yourself**: allowed (session then invalid on next request) as long as another user
  remains; deleting the last user is refused so the instance can't lock everyone out.
- **Weak password**: rejected (< 8 chars) at setup / create / change.
- **Session for a deleted user**: the gate rechecks the user exists, so it becomes 401.
- **Secret rotation**: changing `SESSION_SECRET` invalidates all sessions (re-login), as before.
