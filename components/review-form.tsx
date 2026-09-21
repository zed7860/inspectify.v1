"use client";
import { readJsonResponse } from "@/lib/http/response";
import { finishAction } from "@/components/action-feedback";

import { useState } from "react";

export function ReviewForm({ inspectionId, version, role }: { inspectionId: string; version: number; role: string }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function act(decision: "approve" | "reject") {
    const form = document.getElementById("review-form") as HTMLFormElement;
    const data = new FormData(form);
    if (!String(data.get("comments") || "").trim()) {
      setErr("Review comments are required.");
      return;
    }

    setBusy(true);
    setErr("");
    data.set("decision", decision);
    data.set("expectedVersion", String(version));
    try {
    const response = await fetch(`/api/inspections/${inspectionId}/review`, { method: "POST", body: data });
    const result = await readJsonResponse(response);
    if (!response.ok) {
      setErr(result.error || "Unable to save review.");
      setBusy(false);
      return;
    }
    finishAction(result.delivery?.status === "failed" ? "Review saved. Email delivery failed; see the delivery notice for details." : decision === "approve" ? "Inspection approved successfully." : "Inspection rejected successfully.");
    } catch { setErr("Connection failed. Please try again."); }
    finally { setBusy(false); }
  }

  return (
    <div className="card reviewbox">
      <h2>{role === "PMC" ? "PMC Review" : "Client Final Review"}</h2>
      <form id="review-form" onSubmit={(event) => event.preventDefault()}>
        <input type="hidden" name="stage" value={role} />
        <div className="field"><label>Reason</label><input name="reason" placeholder="Optional" /></div>
        <div className="field"><label>Review Comments</label><textarea name="comments" required rows={4} placeholder="Enter review observations…" /></div>
        <div className="field"><label>Review Photos <span className="muted">(optional)</span></label><input name="photos" type="file" accept="image/jpeg,image/png,image/webp" capture="environment" multiple /></div>
      </form>
      {err && <p className="error">{err}</p>}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, justifyContent: "flex-end" }}>
        <button className="btn btn-danger" disabled={busy} onClick={() => act("reject")}>Reject</button>
        <button className="btn btn-primary" disabled={busy} onClick={() => act("approve")}>{role === "CLIENT" ? "Final Approve" : "Approve"}</button>
      </div>
    </div>
  );
}
