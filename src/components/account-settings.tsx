"use client";

import { useState } from "react";
import { changePassword } from "@/lib/supabase";

export function AccountSettings({
  name,
  email,
  role,
}: {
  name: string;
  email: string;
  role: string;
}) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const matches = newPassword.length > 0 && newPassword === confirmPassword;

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (newPassword !== confirmPassword) {
      setMessage("New passwords do not match.");
      return;
    }
    setBusy(true);
    setMessage("");
    try {
      await changePassword(currentPassword, newPassword);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setMessage("Password changed successfully.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Password could not be changed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-xl border border-[var(--border)] bg-surface-1 p-4 sm:p-6">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-text-secondary">{role} settings</p>
        <h2 className="font-display mt-1 text-2xl font-semibold">Account settings</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <ReadOnly label="Name" value={name} />
          <ReadOnly label="Email" value={email} />
        </div>
      </div>
      <form onSubmit={submit} className="mt-6 max-w-xl space-y-4">
        <div>
          <h3 className="font-semibold">Change password</h3>
          <p className="mt-1 text-sm text-text-secondary">Confirm your current password before choosing a new one.</p>
        </div>
        <PasswordInput label="Current password" value={currentPassword} onChange={setCurrentPassword} visible={showCurrent} onToggle={() => setShowCurrent(value => !value)} />
        <PasswordInput label="New password" value={newPassword} onChange={setNewPassword} visible={showNew} onToggle={() => setShowNew(value => !value)} />
        <div>
          <PasswordInput label="Confirm new password" value={confirmPassword} onChange={setConfirmPassword} visible={showConfirm} onToggle={() => setShowConfirm(value => !value)} />
          <p aria-live="polite" className={`mt-1 min-h-5 text-xs font-semibold ${confirmPassword ? matches ? "text-success" : "text-danger" : "text-text-secondary"}`}>
            {confirmPassword ? matches ? "Passwords match." : "Passwords do not match." : "Use at least 8 characters."}
          </p>
        </div>
        <button type="submit" disabled={busy || !currentPassword || newPassword.length < 8 || !matches} className="min-h-11 rounded-lg bg-accent px-4 text-sm font-semibold text-[var(--accent-contrast)] disabled:cursor-not-allowed disabled:opacity-40">
          {busy ? "Updating password…" : "Change password"}
        </button>
        {message && <p role="status" className="rounded-lg border border-[var(--border)] bg-surface-2 p-3 text-sm">{message}</p>}
      </form>
    </section>
  );
}

function ReadOnly({ label, value }: { label: string; value: string }) {
  return <div className="rounded-lg border border-[var(--border)] bg-surface-0 px-3 py-3"><p className="text-xs font-bold uppercase tracking-[0.1em] text-text-secondary">{label}</p><p className="mt-1 font-semibold">{value}</p></div>;
}

function PasswordInput({ label, value, onChange, visible, onToggle }: { label: string; value: string; onChange: (value: string) => void; visible: boolean; onToggle: () => void }) {
  return <label className="block text-sm font-semibold">{label}<div className="mt-1 flex min-w-0 gap-2"><input required minLength={8} type={visible ? "text" : "password"} value={value} onChange={event => onChange(event.target.value)} className="min-h-12 min-w-0 flex-1 rounded-lg border border-[var(--border)] bg-surface-0 px-3 py-3" /><button type="button" onClick={onToggle} className="min-h-12 shrink-0 rounded-lg border border-[var(--border)] px-3 text-xs font-semibold text-text-secondary hover:bg-surface-2">{visible ? "Hide" : "Show"}</button></div></label>;
}
