import { useEffect, useState } from "react";
import { useAlbum } from "../store";

interface UsersPanelProps {
  open: boolean;
  onClose: () => void;
}

// Basic account management (spec 026): list users, add / remove, and change your own password.
// All users are equal, so any signed-in user can manage accounts.
export function UsersPanel({ open, onClose }: UsersPanelProps) {
  const { users, currentUser, refreshUsers, addUser, deleteUser, changePassword } = useAlbum();
  const [newUser, setNewUser] = useState("");
  const [newPass, setNewPass] = useState("");
  const [addError, setAddError] = useState<string | null>(null);
  const [cur, setCur] = useState("");
  const [next, setNext] = useState("");
  const [pwMsg, setPwMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    if (open) void refreshUsers();
  }, [open, refreshUsers]);

  if (!open) return null;

  const submitAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddError(null);
    const res = await addUser(newUser.trim(), newPass);
    if (res.ok) {
      setNewUser("");
      setNewPass("");
    } else {
      setAddError(res.error ?? "Could not add the user.");
    }
  };

  const submitPw = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await changePassword(cur, next);
    if (res.ok) {
      setCur("");
      setNext("");
      setPwMsg({ ok: true, text: "Password changed." });
    } else {
      setPwMsg({ ok: false, text: res.error ?? "Could not change the password." });
    }
  };

  const field = "min-w-0 flex-1 rounded-md border border-line bg-surface px-2 py-1.5 text-[12.5px] text-ink placeholder:text-faint focus:border-accent focus:outline-none";

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 px-4">
      <button aria-label="Close" className="absolute inset-0 cursor-default" onClick={onClose} />
      <div className="relative w-[400px] rounded-xl border border-line bg-surface p-5 shadow-soft">
        <div className="flex items-center justify-between">
          <div className="font-display text-[15px] text-ink">Users</div>
          <button onClick={onClose} className="text-[13px] text-muted hover:text-ink">
            ✕
          </button>
        </div>

        <div className="mt-3 flex flex-col gap-1">
          {users.map((u) => (
            <div key={u.id} className="flex items-center justify-between rounded-md bg-surface-2 px-3 py-1.5 text-[13px]">
              <span className="text-ink">
                {u.username}
                {u.id === currentUser?.id && <span className="ml-1 text-[11px] text-muted">(you)</span>}
              </span>
              <button
                disabled={users.length <= 1}
                onClick={() => {
                  if (confirm(`Delete "${u.username}"?`)) void deleteUser(u.id);
                }}
                className="text-[12px] text-muted hover:text-[#c0392b] disabled:opacity-30 disabled:hover:text-muted"
              >
                Remove
              </button>
            </div>
          ))}
        </div>

        <form onSubmit={submitAdd} className="mt-3 border-t border-line pt-3">
          <div className="text-[11px] uppercase tracking-wide text-faint">Add a user</div>
          <div className="mt-2 flex gap-2">
            <input value={newUser} onChange={(e) => setNewUser(e.target.value)} placeholder="Username" className={field} />
            <input type="password" value={newPass} onChange={(e) => setNewPass(e.target.value)} placeholder="Password" className={field} />
            <button type="submit" className="rounded-md bg-accent px-3 text-[12.5px] text-white hover:bg-accent-ink">
              Add
            </button>
          </div>
          {addError && <div className="mt-1 text-[11.5px] text-[#c0392b]">{addError}</div>}
        </form>

        <form onSubmit={submitPw} className="mt-3 border-t border-line pt-3">
          <div className="text-[11px] uppercase tracking-wide text-faint">Change your password</div>
          <div className="mt-2 flex gap-2">
            <input type="password" value={cur} onChange={(e) => setCur(e.target.value)} placeholder="Current" className={field} />
            <input type="password" value={next} onChange={(e) => setNext(e.target.value)} placeholder="New (8+)" className={field} />
            <button type="submit" className="rounded-md border border-line px-3 text-[12.5px] text-muted hover:text-ink">
              Save
            </button>
          </div>
          {pwMsg && <div className={`mt-1 text-[11.5px] ${pwMsg.ok ? "text-muted" : "text-[#c0392b]"}`}>{pwMsg.text}</div>}
        </form>
      </div>
    </div>
  );
}
