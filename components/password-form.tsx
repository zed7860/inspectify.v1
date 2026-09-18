"use client";

import { useState } from "react";

export function PasswordForm({ adminUserId }: { adminUserId?: string }) {
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    const form = new FormData(event.currentTarget);
    const endpoint = adminUserId ? "/api/admin/users" : "/api/auth/password";
    if (adminUserId) form.set("action", "resetPassword");
    if (adminUserId) form.set("id", adminUserId);

    const response = await fetch(endpoint, { method: "POST", body: form });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      setError(data.error || "Unable to update the password.");
      setBusy(false);
      return;
    }

    event.currentTarget.reset();
    setMessage(adminUserId ? "Password reset successfully." : "Your password has been changed.");
    setBusy(false);
  }

  return (
    <form className="formgrid" onSubmit={submit}>
      <div className="field span2">
        <label htmlFor={adminUserId ? "reset-password" : "new-password"}>{adminUserId ? "New temporary password" : "New password"}</label>
        <input id={adminUserId ? "reset-password" : "new-password"} name="password" type="password" minLength={12} required autoComplete="new-password" />
      </div>
      <button className="btn btn-primary" disabled={busy}>{busy ? "Updating…" : adminUserId ? "Reset password" : "Change password"}</button>
      {error && <p className="error span2">{error}</p>}
      {message && <p className="success span2">{message}</p>}
    </form>
  );
}