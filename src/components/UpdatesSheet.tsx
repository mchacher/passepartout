import { useState } from "react";
import { useAlbum } from "../store";

interface UpdatesSheetProps {
  open: boolean;
  onClose: () => void;
}

const MANUAL_COMMAND = "docker compose pull && docker compose up -d";

// The update sheet (spec 025): shows current -> latest and either a one-click "Update now"
// (when the server has the Docker socket) or the manual command. After "Update now" it polls
// the server's version and reloads once the new one is live.
export function UpdatesSheet({ open, onClose }: UpdatesSheetProps) {
  const { versionInfo, applyUpdate, refreshVersion } = useAlbum();
  const [phase, setPhase] = useState<"idle" | "updating" | "error">("idle");
  const [message, setMessage] = useState("");

  if (!open || !versionInfo) return null;
  const { current, latest, canApply } = versionInfo;

  const startUpdate = async () => {
    setPhase("updating");
    setMessage("Pulling the new version and restarting the server. The page reloads when it is back...");
    const res = await applyUpdate();
    if (!res.started) {
      setPhase("error");
      setMessage("Could not start the update on the server.");
      return;
    }
    // Poll the server version; the containers are recreated, so failures are expected during
    // the swap. Reload once it reports the target version.
    let tries = 0;
    const tick = async () => {
      tries += 1;
      await refreshVersion();
      const now = useAlbum.getState().versionInfo?.current;
      if (latest && now === latest) {
        location.reload();
        return;
      }
      if (tries > 60) {
        setPhase("error");
        setMessage("The update is taking longer than expected. Check the server logs, or reload the page.");
        return;
      }
      setTimeout(() => void tick(), 3000);
    };
    setTimeout(() => void tick(), 4000);
  };

  const closeBtn = (label: string) => (
    <button onClick={onClose} className="rounded-md border border-line px-3 py-1.5 text-[12.5px] text-muted hover:text-ink">
      {label}
    </button>
  );

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 px-4">
      <button aria-label="Close" className="absolute inset-0 cursor-default" onClick={phase === "updating" ? undefined : onClose} />
      <div className="relative w-[360px] rounded-xl border border-line bg-surface p-5 shadow-soft">
        <div className="font-display text-[15px] text-ink">Update available</div>
        <div className="mt-3 flex items-center gap-2 text-[13px]">
          <span className="font-mono text-muted">v{current}</span>
          <span className="text-faint">&rarr;</span>
          <span className="font-mono font-semibold text-accent">v{latest}</span>
        </div>

        {phase === "idle" &&
          (canApply ? (
            <>
              <p className="mt-3 text-[12.5px] leading-snug text-muted">
                Pull the new version and restart the server. It takes a minute; the page reloads when it is back.
              </p>
              <div className="mt-4 flex justify-end gap-2">
                {closeBtn("Later")}
                <button
                  onClick={() => void startUpdate()}
                  className="rounded-md bg-accent px-3 py-1.5 text-[12.5px] text-white transition-colors hover:bg-accent-ink"
                >
                  Update now
                </button>
              </div>
            </>
          ) : (
            <>
              <p className="mt-3 text-[12.5px] leading-snug text-muted">
                One-click update is off on this server (the Docker socket is not mounted). Update from the host:
              </p>
              <pre className="mt-2 overflow-x-auto rounded-md bg-surface-2 px-3 py-2 font-mono text-[11.5px] text-ink">{MANUAL_COMMAND}</pre>
              <div className="mt-4 flex justify-end">{closeBtn("Close")}</div>
            </>
          ))}

        {phase === "updating" && <p className="mt-3 text-[12.5px] leading-snug text-muted">{message}</p>}

        {phase === "error" && (
          <>
            <p className="mt-3 text-[12.5px] leading-snug text-[#c0392b]">{message}</p>
            <pre className="mt-2 overflow-x-auto rounded-md bg-surface-2 px-3 py-2 font-mono text-[11.5px] text-ink">{MANUAL_COMMAND}</pre>
            <div className="mt-3 flex justify-end">{closeBtn("Close")}</div>
          </>
        )}
      </div>
    </div>
  );
}
