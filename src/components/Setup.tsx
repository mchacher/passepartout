import { useState } from "react";
import { useAlbum } from "../store";

// First-run setup shown in server mode when no account exists yet (spec 026): choose the first
// username + password.
export function Setup() {
  const setup = useAlbum((s) => s.setup);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    if (!username.trim()) return setError("Choose a username.");
    if (password.length < 8) return setError("Password must be at least 8 characters.");
    if (password !== confirm) return setError("Passwords do not match.");
    setBusy(true);
    setError(null);
    const res = await setup(username.trim(), password);
    setBusy(false);
    if (!res.ok) setError(res.error ?? "Could not create the account.");
  };

  return (
    <div className="grid h-screen place-items-center bg-surface px-4">
      <form onSubmit={submit} className="w-[340px] rounded-xl border border-line bg-surface-2 p-6 shadow-soft">
        <div className="font-display text-[16px] font-semibold text-ink">Welcome to Passe·partout</div>
        <p className="mb-4 mt-1 text-[12.5px] leading-snug text-muted">
          Create the first account. You can add more later.
        </p>
        <input
          autoFocus
          value={username}
          onChange={(e) => {
            setUsername(e.target.value);
            setError(null);
          }}
          autoComplete="username"
          placeholder="Username"
          className="w-full rounded-md border border-line bg-surface px-3 py-2 text-[13px] text-ink placeholder:text-faint focus:border-accent focus:outline-none"
        />
        <input
          type="password"
          value={password}
          onChange={(e) => {
            setPassword(e.target.value);
            setError(null);
          }}
          autoComplete="new-password"
          placeholder="Password (at least 8 characters)"
          className="mt-2 w-full rounded-md border border-line bg-surface px-3 py-2 text-[13px] text-ink placeholder:text-faint focus:border-accent focus:outline-none"
        />
        <input
          type="password"
          value={confirm}
          onChange={(e) => {
            setConfirm(e.target.value);
            setError(null);
          }}
          autoComplete="new-password"
          placeholder="Confirm password"
          className="mt-2 w-full rounded-md border border-line bg-surface px-3 py-2 text-[13px] text-ink placeholder:text-faint focus:border-accent focus:outline-none"
        />
        {error && <div className="mt-2 text-[12px] text-[#c0392b]">{error}</div>}
        <button
          type="submit"
          disabled={busy}
          className="mt-4 w-full rounded-md bg-accent px-3 py-2 text-[13px] text-white transition-colors hover:bg-accent-ink disabled:opacity-50"
        >
          {busy ? "Creating..." : "Create account"}
        </button>
      </form>
    </div>
  );
}
