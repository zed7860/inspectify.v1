"use client";
import { readJsonResponse } from "@/lib/http/response";
import { useConfirmation } from "@/components/confirmation-dialog";
import { useState, type ComponentProps } from "react";
import { finishAction, notifySuccess } from "@/components/action-feedback";

export function AdminForm({ children, successMessage, ...props }: ComponentProps<"form"> & { successMessage?: string }) {
  const { confirm, confirmationDialog } = useConfirmation();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [failed, setFailed] = useState(false);
  return <><form {...props} onSubmit={async (event) => {
    event.preventDefault();
    if (busy) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    const action = String(data.get("action") || "");
    const deleting = action === "delete";
    const statusSelect = form.elements.namedItem("isActive");
    const wasActive = statusSelect instanceof HTMLSelectElement && Array.from(statusSelect.options).some((option) => option.defaultSelected && option.value === "true");
    const disabling = data.get("isActive") === "false" && (action === "setActive" || wasActive);
    if ((deleting || disabling) && !await confirm({
      title: deleting ? "Delete this record?" : "Disable this user?",
      description: deleting ? (String(props.action).includes("/users") ? "The user will lose access permanently. Their inspection history will be retained. This cannot be undone." : "This record will be permanently deleted. This cannot be undone.") : "The user will lose access until an administrator enables their account again.",
      label: deleting ? "Delete permanently" : "Disable user"
    })) return;
    setBusy(true); setMessage(""); setFailed(false);
    const success = successMessage || (deleting ? "Deleted successfully." : "Saved successfully.");
    try {
      const response = await fetch(String(props.action), { method: "POST", body: data });
      if (response.redirected) {
        const url = new URL(response.url);
        if (!response.ok || (url.pathname === "/login" && props.action !== "/api/auth/logout") || url.searchParams.get("test") === "failed") { location.assign(response.url); return; }
        finishAction(success, response.url); return;
      }
      const result = await readJsonResponse(response);
      if (!response.ok) throw new Error(result.error || "Unable to save.");
      const text = result.message || success;
      if (result.redirect) { finishAction(text, result.redirect); return; }
      setMessage(text); notifySuccess(text);
    } catch (error) { setFailed(true); setMessage(error instanceof Error ? error.message : "Unable to save. Please try again."); }
    finally { setBusy(false); }
  }}><fieldset disabled={busy} style={{ border: 0, padding: 0, margin: 0, minWidth: 0, display: "contents" }}>{children}</fieldset>{busy && <p role="status">Processing…</p>}{message && <p role={failed ? "alert" : "status"} className={failed ? "error" : "success"}>{message}</p>}</form>{confirmationDialog}</>;
}
