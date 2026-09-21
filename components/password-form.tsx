"use client";
import { readJsonResponse } from "@/lib/http/response";
import { notifySuccess } from "@/components/action-feedback";

import { useConfirmation } from "@/components/confirmation-dialog";
import { useState } from "react";

export function PasswordForm({ adminUserId }: { adminUserId?: string }) {
  const { confirm, confirmationDialog } = useConfirmation();
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const element = event.currentTarget;
    if (adminUserId && !await confirm({ title: "Reset user password?", description: "The user will need the new password to sign in again.", label: "Reset password" })) return;
    setBusy(true);
    setError("");
    setMessage("");
    const form = new FormData(element);
    const endpoint = adminUserId ? "/api/admin/users" : "/api/auth/password";
    if (adminUserId) form.set("action", "resetPassword");
    if (adminUserId) form.set("id", adminUserId);

    try {
    const response = await fetch(endpoint, { method: "POST", body: form });
    if (response.redirected) { location.href = response.url; return; }
    const data = await readJsonResponse(response);
    if (!response.ok) {
      setError(data.error || "Unable to update the password.");
      setBusy(false);
      return;
    }

    element.reset();
    notifySuccess(adminUserId ? "Password reset successfully." : "Your password has been changed.");
    setMessage(adminUserId ? "Password reset successfully." : "Your password has been changed.");
    } catch { setError("Connection failed. Please try again."); }
    finally { setBusy(false); }
  }

  return (
    <><form className="formgrid" onSubmit={submit}>
      <div className="field span2">
        <label htmlFor={adminUserId ? `reset-password-${adminUserId}` : "new-password"}>{adminUserId ? "New temporary password" : "New password"}</label>
        <input id={adminUserId ? `reset-password-${adminUserId}` : "new-password"} name="password" type="password" minLength={12} required autoComplete="new-password" />
      </div>
      <button className="btn btn-primary" disabled={busy}>{busy ? "Updating…" : adminUserId ? "Reset password" : "Change password"}</button>
      {error && <p className="error span2">{error}</p>}
      {message && <p className="success span2">{message}</p>}
    </form>{confirmationDialog}</>
  );
}