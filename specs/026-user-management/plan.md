# 026 - Basic user management - implementation plan

## Server

1. **`server/src/db.ts`**: add a `users` table migration (`id` TEXT PK, `username` TEXT UNIQUE
   COLLATE NOCASE, `passwordHash` TEXT, `createdAt` INTEGER) and Store methods: `countUsers`,
   `createUser(username, hash)`, `findUserByName`, `getUser(id)`, `listUsers`, `deleteUser(id)`,
   `updateUserPassword(id, hash)`.
2. **`server/src/app.ts`**: rework auth.
   - Session cookie value = the user id (signed). `currentUserId(req)` unsigns + checks the user
     still exists.
   - Gate: allow `GET /health`, `GET /auth/status`, `POST /auth/setup`, `POST /auth/login`,
     `POST /auth/logout` without a session; everything else requires a valid user.
   - `GET /auth/status` -> `{ needsSetup: countUsers()===0, authed: !!currentUserId }`.
   - `POST /auth/setup` -> 409 if users exist; validate; create; set session; 201 `{ username }`.
   - `POST /auth/login` -> find by name + bcrypt compare -> set session; 401 otherwise.
   - `GET /auth/me` -> `{ id, username }`.
   - `GET /users`, `POST /users` (409 on dup), `DELETE /users/:id` (refuse last), `POST
     /account/password` (verify current).
   - Drop the `passwordHash` config; keep `sessionSecret`. Remove `PASSEPARTOUT_PASSWORD` from
     `index.ts`.
3. **`server/src/*.test.ts`**: setup (first ok, second 409), login ok/ko, gate 401, users
   create/list/delete (+ refuse last), change password, validation (short password, dup name).

## Frontend

4. **`src/persistence.ts`**: `PersistenceBackend`
   - `authStatus(): Promise<{ needsSetup: boolean; authed: boolean }>`; `me()`;
     `setup(u,p)`; `login(u,p)` (was `login(password)`); `logout()`;
     `listUsers()`, `createUser(u,p)`, `deleteUser(id)`, `changePassword(cur,next)`.
   - local backend: `needsSetup:false`, `authed:true`, users ops are no-ops.
5. **`src/store.ts`**: `needsSetup`, `currentUser`, `users` state; actions `setup`, `login(u,p)`,
   `logout`, `refreshUsers`, `addUser`, `deleteUser`, `changePassword`. `initProjects` reads
   `authStatus` first (remote): needsSetup -> stop for Setup; !authed -> stop for Login.
6. **Components**: `Setup.tsx` (username + password + confirm), rework `Login.tsx`
   (username + password), `UsersPanel.tsx` (list/add/remove + change-own-password). `App` routes
   Setup / Login / app. `ProjectMenu` shows the current user + Users + Log out (remote only).

## Packaging / docs

7. `docker-compose.yml`: drop `PASSEPARTOUT_PASSWORD`; keep `SESSION_SECRET`; note first-run setup.
8. `docs/self-hosting.md`: server mode now = "open the URL, create the first account", user
   management, no shared password.

## Test Plan

| Module | Scenario | Expected |
| ------ | -------- | -------- |
| users store | create / find (case-insensitive) / list / delete / count | correct rows; dup name rejected by UNIQUE |
| /auth/setup | first call | 201 + session + user created |
| /auth/setup | when a user exists | 409 |
| /auth/status | 0 users / 1 user, no session / authed | needsSetup true / false+authed false / authed true |
| /auth/login | right / wrong password | 200 + cookie / 401 |
| gate | no session, non-open route | 401 |
| /users | create dup | 409; create ok -> listed |
| /users DELETE | last user | refused; non-last -> ok |
| /account/password | wrong current / ok | 401 / 200 (new password then logs in) |
| remote adapter | login(u,p)/setup/users ops (mocked fetch) | correct endpoints/methods |

Engine invariant: N/A (auth/storage only). Local mode unchanged; the 254 frontend + server
suites stay green.

## Verification (Phase 5)

- Fresh `docker compose up` (no PASSEPARTOUT_PASSWORD): open the URL -> **Setup** -> create
  account -> app. Reload -> still logged in. Add a second user; log in as them in another
  browser -> same albums. Delete a user; try the last -> refused. Change own password -> re-login
  works. Local build (no api) -> no setup/login, unchanged.
