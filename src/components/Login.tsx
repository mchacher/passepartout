import { useState } from "react";

interface LoginProps {
  onSubmit: (password: string) => Promise<boolean>;
}

// The single-password gate shown in server (remote) mode before the app (spec 024).
export function Login({ onSubmit }: LoginProps) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy || !password) return;
    setBusy(true);
    setError(false);
    const ok = await onSubmit(password);
    setBusy(false);
    if (!ok) {
      setError(true);
      setPassword("");
    }
  };

  return (
    <div className="grid h-screen place-items-center bg-surface px-4">
      <form onSubmit={submit} className="w-[320px] rounded-xl border border-line bg-surface-2 p-6 shadow-soft">
        <div className="font-display text-[16px] font-semibold text-ink">Passe·partout</div>
        <p className="mb-4 mt-1 text-[12.5px] leading-snug text-muted">
          Enter the password to open this album server.
        </p>
        <input
          type="password"
          autoFocus
          value={password}
          onChange={(e) => {
            setPassword(e.target.value);
            setError(false);
          }}
          placeholder="Password"
          className="w-full rounded-md border border-line bg-surface px-3 py-2 text-[13px] text-ink placeholder:text-faint focus:border-accent focus:outline-none"
        />
        {error && <div className="mt-2 text-[12px] text-[#c0392b]">Wrong password.</div>}
        <button
          type="submit"
          disabled={busy || !password}
          className="mt-4 w-full rounded-md bg-accent px-3 py-2 text-[13px] text-white transition-colors hover:bg-accent-ink disabled:opacity-50"
        >
          {busy ? "Unlocking..." : "Unlock"}
        </button>
      </form>
    </div>
  );
}
