import { useState } from "react";
import { useAlbum } from "../store";
import { useT } from "../useT";
import { LanguageMenu } from "./LanguageMenu";

// First-run setup shown in server mode when no account exists yet (spec 026): choose the first
// username + password. A language toggle is present (spec 032) so setup can be done in French.
export function Setup() {
  const setup = useAlbum((s) => s.setup);
  const { t } = useT();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    if (!username.trim()) return setError(t("auth.err.username"));
    if (password.length < 8) return setError(t("auth.err.passwordMin"));
    if (password !== confirm) return setError(t("auth.err.mismatch"));
    setBusy(true);
    setError(null);
    const res = await setup(username.trim(), password);
    setBusy(false);
    if (!res.ok) setError(t("auth.err.createFailed"));
  };

  return (
    <div className="grid h-screen place-items-center bg-surface px-4">
      <form onSubmit={submit} className="w-[340px] rounded-xl border border-line bg-surface-2 p-6 shadow-soft">
        <div className="mb-2 flex justify-end">
          <LanguageMenu />
        </div>
        <div className="font-display text-[16px] font-semibold text-ink">{t("auth.setup.title")}</div>
        <p className="mb-4 mt-1 text-[12.5px] leading-snug text-muted">{t("auth.setup.subtitle")}</p>
        <input
          autoFocus
          value={username}
          onChange={(e) => {
            setUsername(e.target.value);
            setError(null);
          }}
          autoComplete="username"
          placeholder={t("auth.username")}
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
          placeholder={t("auth.passwordMin")}
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
          placeholder={t("auth.confirmPassword")}
          className="mt-2 w-full rounded-md border border-line bg-surface px-3 py-2 text-[13px] text-ink placeholder:text-faint focus:border-accent focus:outline-none"
        />
        {error && <div className="mt-2 text-[12px] text-[#c0392b]">{error}</div>}
        <button
          type="submit"
          disabled={busy}
          className="mt-4 w-full rounded-md bg-accent px-3 py-2 text-[13px] text-white transition-colors hover:bg-accent-ink disabled:opacity-50"
        >
          {busy ? t("auth.creating") : t("auth.createAccount")}
        </button>
      </form>
    </div>
  );
}
