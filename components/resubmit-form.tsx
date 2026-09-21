"use client";
import { readJsonResponse } from "@/lib/http/response";
import { finishAction } from "@/components/action-feedback";

import { useState } from "react";
import { PhotoPicker } from "@/components/photo-picker";

export function ResubmitForm({ inspectionId, description }: { inspectionId: string; description: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
    const response = await fetch(`/api/inspections/${inspectionId}/resubmit`, { method: "POST", body: new FormData(event.currentTarget) });
    const result = await readJsonResponse(response);
    if (!response.ok) {
      setError(result.error || "Unable to resubmit inspection.");
      setBusy(false);
      return;
    }
    finishAction(result.delivery?.status === "failed" ? "Inspection resubmitted. Email delivery failed; see the delivery notice for details." : "Inspection resubmitted. Project notification accepted by the mail server.");
    } catch { setError("Connection failed. Please try again."); }
    finally { setBusy(false); }
  }

  return (
    <section className="card">
      <p className="eyebrow">Action required</p>
      <h2>Edit and resubmit</h2>
      <p className="muted">Update the description and add corrected evidence. The inspection will return to PMC review first.</p>
      <form className="formgrid" onSubmit={submit}>
        <div className="field span2"><label>Updated description</label><textarea name="description" defaultValue={description} required minLength={3} rows={5} /></div>
        <div className="field span2"><label>Corrected photos</label><PhotoPicker /></div>
        {error && <p className="error span2">{error}</p>}
        <button className="btn btn-primary" disabled={busy}>{busy ? "Resubmitting…" : "Resubmit for PMC review"}</button>
      </form>
    </section>
  );
}
