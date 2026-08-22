import { useState } from "react";
import { useAlbum } from "../store";
import { useT } from "../useT";
import { LanguageMenu } from "./LanguageMenu";

// The account login shown in server mode when not signed in (spec 026). A language toggle is
// present (spec 032) so a French user signs in in French. The credentials error comes from the
// server in English, so we always show our own translated message.
export function Login() {
  const login = useAlbum((s) => s.login);
  const { t } = useT();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy || !username || !password) return;
    setBusy(true);
    setError(null);
    const res = await login(username.trim(), password);
    setBusy(false);
    if (!res.ok) {
      setError(t("auth.err.credentials"));
      setPassword("");
    }
  };

  return (
    <div className="grid h-screen place-items-center bg-surface px-4">
      <form onSubmit={submit} className="w-[320px] rounded-xl border border-line bg-surface-2 p-6 shadow-soft">
        <div className="mb-2 flex justify-end">
          <LanguageMenu />
        </div>
        <div className="font-display text-[16px] font-semibold text-ink">Passe·partout</div>
        <p className="mb-4 mt-1 text-[12.5px] leading-snug text-muted">{t("auth.login.subtitle")}</p>
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
          autoComplete="current-password"
          placeholder={t("auth.password")}
          className="mt-2 w-full rounded-md border border-line bg-surface px-3 py-2 text-[13px] text-ink placeholder:text-faint focus:border-accent focus:outline-none"
        />
        {error && <div className="mt-2 text-[12px] text-[#c0392b]">{error}</div>}
        <button
          type="submit"
          disabled={busy || !username || !password}
          className="mt-4 w-full rounded-md bg-accent px-3 py-2 text-[13px] text-white transition-colors hover:bg-accent-ink disabled:opacity-50"
        >
          {busy ? t("auth.signingIn") : t("auth.signIn")}
        </button>
      </form>
    </div>
  );
}
