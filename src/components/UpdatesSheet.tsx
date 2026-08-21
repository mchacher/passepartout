import { useState } from "react";
import { useAlbum } from "../store";
import { useT } from "../useT";

interface UpdatesSheetProps {
  open: boolean;
  onClose: () => void;
}

const MANUAL_COMMAND = "docker compose pull && docker compose up -d";

// The update sheet (spec 025): shows current -> latest and either a one-click "Update now"
// (when the server has the Docker socket) or the manual command. After "Update now" it polls
// the server's version and reloads once the new one is live.
export function UpdatesSheet({ open, onClose }: UpdatesSheetProps) {
  const { versionInfo, beginUpdate } = useAlbum();
  const { t } = useT();
  const [failed, setFailed] = useState(false);

  if (!open || !versionInfo) return null;
  const { current, latest, canApply } = versionInfo;

  // Hand off to the store: on success the non-interruptible overlay (spec 031) takes over the
  // whole screen, so there is nothing more to render here. On a real failure show a translated
  // message plus the manual command as a fallback (the server error is English, so we don't echo
  // it, spec 032).
  const startUpdate = async () => {
    const res = await beginUpdate();
    if (res.locked) return;
    setFailed(true);
  };

  const closeBtn = (label: string) => (
    <button onClick={onClose} className="rounded-md border border-line px-3 py-1.5 text-[12.5px] text-muted hover:text-ink">
      {label}
    </button>
  );

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 px-4">
      <button aria-label={t("update.close")} className="absolute inset-0 cursor-default" onClick={onClose} />
      <div className="relative w-[360px] rounded-xl border border-line bg-surface p-5 shadow-soft">
        <div className="font-display text-[15px] text-ink">{t("update.available")}</div>
        <div className="mt-3 flex items-center gap-2 text-[13px]">
          <span className="font-mono text-muted">v{current}</span>
          <span className="text-faint">&rarr;</span>
          <span className="font-mono font-semibold text-accent">v{latest}</span>
        </div>

        {!failed &&
          (canApply ? (
            <>
              <p className="mt-3 text-[12.5px] leading-snug text-muted">{t("update.body")}</p>
              <div className="mt-4 flex justify-end gap-2">
                {closeBtn(t("update.later"))}
                <button
                  onClick={() => void startUpdate()}
                  className="rounded-md bg-accent px-3 py-1.5 text-[12.5px] text-white transition-colors hover:bg-accent-ink"
                >
                  {t("update.now")}
                </button>
              </div>
            </>
          ) : (
            <>
              <p className="mt-3 text-[12.5px] leading-snug text-muted">{t("update.socketOff")}</p>
              <pre className="mt-2 overflow-x-auto rounded-md bg-surface-2 px-3 py-2 font-mono text-[11.5px] text-ink">{MANUAL_COMMAND}</pre>
              <div className="mt-4 flex justify-end">{closeBtn(t("update.close"))}</div>
            </>
          ))}

        {failed && (
          <>
            <p className="mt-3 text-[12.5px] leading-snug text-[#c0392b]">{t("update.err.start")}</p>
            <pre className="mt-2 overflow-x-auto rounded-md bg-surface-2 px-3 py-2 font-mono text-[11.5px] text-ink">{MANUAL_COMMAND}</pre>
            <div className="mt-3 flex justify-end">{closeBtn(t("update.close"))}</div>
          </>
        )}
      </div>
    </div>
  );
}
