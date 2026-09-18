"use client";

import { useState } from "react";

export function ReportBrowser({ rows, exportBase }: { rows: any[]; exportBase: string }) {
  const [selected, setSelected] = useState<string[]>([]);
  const selectedQuery = selected.length ? `&ids=${encodeURIComponent(selected.join(","))}` : "";
  const exportUrl = (format: string) => `${exportBase}&format=${format}${selectedQuery}`;
  const allSelected = rows.length > 0 && selected.length === rows.length;

  function toggleAll() {
    setSelected(allSelected ? [] : rows.map((row) => row.id));
  }

  function toggle(id: string) {
    setSelected((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  }

  return (
    <section className="card report-results">
      <div className="section-heading">
        <div><p className="eyebrow">Matching inspections</p><h2>{rows.length} records</h2></div>
        <span className="badge">{selected.length} selected</span>
      </div>
      {rows.length ? <>
        <div className="report-selection-actions">
          <label className="check-label"><input type="checkbox" checked={allSelected} onChange={toggleAll} /> Select all</label>
          <div className="row-actions">
            <a className={`btn btn-primary ${!selected.length ? "is-disabled" : ""}`} href={selected.length ? exportUrl("pdf") : undefined} aria-disabled={!selected.length}>PDF with photos</a>
          </div>
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
