import { useState } from "react";
import { useAlbum } from "../store";
import { useT } from "../useT";
import { UsersPanel } from "./UsersPanel";
import { UpdatesSheet } from "./UpdatesSheet";

// Instance administration (spec 027), separate from the project menu. Server mode only: the
// signed-in user, user management, the app version + check for updates, and log out.
export function AdminMenu() {
  const { currentUser, logout, versionInfo, versionChecking, refreshVersion } = useAlbum();
  const { t } = useT();
  const [open, setOpen] = useState(false);
  const [usersOpen, setUsersOpen] = useState(false);
  const [updatesOpen, setUpdatesOpen] = useState(false);
  const [checked, setChecked] = useState(false);

  const close = () => setOpen(false);
  const check = async () => {
    setChecked(false);
    await refreshVersion(true);
    setChecked(true);
  };

  const v = versionInfo;
  const item = "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[12.5px] text-muted hover:bg-surface-2 hover:text-ink";

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        title={t("admin.title")}
        className="flex h-[32px] w-[32px] items-center justify-center rounded-full border border-line-strong bg-surface-2 text-muted transition-colors hover:border-faint hover:text-ink"
      >
        <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6}>
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z" />
        </svg>
      </button>

      {open && (
        <>
          <button aria-label={t("admin.close")} className="fixed inset-0 z-20 cursor-default" onClick={close} />
          <div className="absolute right-0 z-30 mt-1.5 w-[248px] rounded-xl border border-line bg-surface p-1.5 shadow-soft">
            {currentUser && (
              <div className="px-2 py-1.5 text-[11px] text-faint">{t("admin.signedInAs", { user: currentUser.username })}</div>
            )}

            <button onClick={() => { close(); setUsersOpen(true); }} className={item}>
              <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6}>
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
              {t("admin.users")}
            </button>

            <div className="mt-1 border-t border-line px-2 pb-1 pt-1.5">
              <div className="flex items-center justify-between text-[12px]">
                <span className="text-muted">{t("admin.version")}</span>
                <span className="font-mono text-faint">v{v?.current ?? __APP_VERSION__}</span>
              </div>
              {v?.updateAvailable ? (
                <button
                  onClick={() => { close(); setUpdatesOpen(true); }}
                  className="mt-1.5 w-full rounded-md bg-accent-soft px-2 py-1 text-[12px] text-accent hover:bg-accent hover:text-white"
                >
                  {t("admin.updateTo", { version: v.latest ?? "" })}
                </button>
              ) : (
                <button
                  onClick={() => void check()}
                  disabled={versionChecking}
                  className="mt-1.5 w-full rounded-md border border-line px-2 py-1 text-[12px] text-muted hover:border-faint hover:text-ink disabled:opacity-50"
                >
                  {versionChecking ? t("admin.checking") : t("admin.checkUpdates")}
                </button>
              )}
              {checked && !versionChecking && v && !v.updateAvailable && (
                <div className="mt-1 text-[11px] text-faint">{v.latest ? t("admin.upToDate") : t("admin.noToken")}</div>
              )}
            </div>

            <div className="mt-1 border-t border-line pt-1">
              <button onClick={() => { close(); void logout(); }} className={item}>
                <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6}>
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
                </svg>
                {t("admin.logout")}
              </button>
            </div>
          </div>
        </>
      )}

      <UsersPanel open={usersOpen} onClose={() => setUsersOpen(false)} />
      <UpdatesSheet open={updatesOpen} onClose={() => setUpdatesOpen(false)} />
    </div>
  );
}
