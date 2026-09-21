"use client";
import { DownloadButton } from "@/components/download-button";
import { notifySuccess } from "@/components/action-feedback";

import { readJsonResponse } from "@/lib/http/response";
import { useState } from "react";

export function ReportBrowser({ rows, exportBase }: { rows: any[]; exportBase: string }) {
  const [selected, setSelected] = useState<string[]>([]);
  const [recipients, setRecipients] = useState("");
  const [sending, setSending] = useState(false);
  const [succeeded, setSucceeded] = useState(false);
  const [message, setMessage] = useState("");
  const selectedQuery = selected.length ? `&ids=${encodeURIComponent(selected.join(","))}` : "";
  const exportUrl = (format: string) => `${exportBase}&format=${format}${selectedQuery}`;
  const allSelected = rows.length > 0 && selected.length === rows.length;

  function toggleAll() {
    setSelected(allSelected ? [] : rows.map((row) => row.id));
  }

  function toggle(id: string) {
    setSelected((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  }

  async function emailReport() {
    if (!selected.length || !recipients.trim()) return;
    setSending(true);
    setMessage(""); setSucceeded(false);
    try {
      const response = await fetch("/api/reports/email", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ids:selected,recipients}) });
      const result = await readJsonResponse(response);
      if (!response.ok) {
        if (result.accepted?.length && result.rejected?.length) setRecipients(result.rejected.join(", "));
        throw new Error(result.error || "Unable to send the report.");
      }
      setSucceeded(true); setMessage(result.message);
      notifySuccess(result.message);
    } catch (error: any) {
      setMessage(error?.message || "Unable to send the report.");
    } finally {
      setSending(false);
    }
  }

  return (
    <section className="card report-results">
      <div className="section-heading">
        <div><p className="eyebrow">Matching inspections</p><h2>{rows.length} records</h2><p className="muted">Select up to 20 inspections per report. Separate email addresses with commas or semicolons.</p></div>
        <span className="badge">{selected.length} selected</span>
      </div>
      {rows.length ? <>
        <div className="report-selection-actions">
          <label className="check-label"><input type="checkbox" checked={allSelected} onChange={toggleAll} /> Select all</label>
          <div className="row-actions">
            <DownloadButton href={exportUrl("pdf")} filename="inspection-report.pdf" disabled={!selected.length}>PDF with photos</DownloadButton>
          </div>
        </div>
        <div className="report-email-actions">
          <div className="field"><label htmlFor="report-recipients">Send report to email addresses</label><input id="report-recipients" value={recipients} onChange={(event) => setRecipients(event.target.value)} placeholder="one@example.com; two@example.com" /></div>
          <button type="button" className="btn btn-secondary" disabled={!selected.length || !recipients.trim() || sending} onClick={emailReport}>{sending ? "Sending…" : "Send report"}</button>
          {message && <small className={succeeded ? "success" : "error"}>{message}</small>}
        </div>
        <div className="report-list">{rows.map((row) => <label className="report-row" key={row.id}>
          <input type="checkbox" checked={selected.includes(row.id)} onChange={() => toggle(row.id)} />
          <span><strong>{row.inspection_number}</strong><small>{row.projects?.name || "No project"} · {row.location} · {row.categories?.name || "No category"}</small></span>
          <span className="badge">{row.status.replaceAll("_", " ")}</span>
        </label>)}</div>
      </> : <p className="muted">No inspections match the selected filters.</p>}
    </section>
  );
}
