import { useAlbum } from "../store";

// The non-interruptible update overlay (spec 031). Once an update starts it covers the whole
// screen with no way to dismiss or re-trigger it: the containers are being recreated and the
// user must not interrupt the swap. It survives a page refresh (the lock is persisted) and the
// store polls the server until the new version is live, then reloads. If the update takes too
// long the overlay switches to a recovery state offering a manual reload.
export function UpdatingOverlay() {
  const updating = useAlbum((s) => s.updating);
  const dismissUpdate = useAlbum((s) => s.dismissUpdate);
  if (!updating) return null;

  const target = updating.target ? `v${updating.target}` : "the new version";

  return (
    <div className="fixed inset-0 z-[100] grid place-items-center bg-surface px-6">
      <div className="w-[360px] max-w-full text-center">
        {!updating.failed ? (
          <>
            <div className="mx-auto mb-5 h-8 w-8 animate-spin rounded-full border-2 border-line border-t-accent" />
            <div className="font-display text-[16px] text-ink">Updating to {target}</div>
            <p className="mt-2 text-[12.5px] leading-relaxed text-muted">
              Keep this tab open. The server is restarting and the app reloads on its own when the
              new version is live. This usually takes under a minute.
            </p>
          </>
        ) : (
          <>
            <div className="font-display text-[16px] text-ink">This is taking longer than expected</div>
            <p className="mt-2 text-[12.5px] leading-relaxed text-muted">
              The update to {target} has not come back yet. Reload to check, or dismiss and verify
              the server from the host.
            </p>
            <div className="mt-5 flex justify-center gap-2">
              <button
                onClick={() => dismissUpdate()}
                className="rounded-md border border-line px-3 py-1.5 text-[12.5px] text-muted hover:text-ink"
              >
                Dismiss
              </button>
              <button
                onClick={() => location.reload()}
                className="rounded-md bg-accent px-3 py-1.5 text-[12.5px] text-white transition-colors hover:bg-accent-ink"
              >
                Reload
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
