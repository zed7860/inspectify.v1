"use client";
import { readJsonResponse } from "@/lib/http/response";
import { finishAction } from "@/components/action-feedback";

import { useState } from "react";
import { PhotoPicker } from "@/components/photo-picker";

export function NewInspectionForm({ projects, categories }: { projects: any[]; categories: any[] }) {
  const [categoryId, setCategoryId] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const subcategories = categories.find((category) => category.id === categoryId)?.subcategories || [];

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected.length) { setError("Select at least one subcategory."); return; }
    setBusy(true);
    setError("");
    try {
    const response = await fetch("/api/inspections", { method: "POST", body: new FormData(event.currentTarget) });
    const result = await readJsonResponse(response);
    if (!response.ok) {
      setError(result.error || "Unable to submit inspection.");
      setBusy(false);
      return;
    }
    finishAction(result.delivery?.status === "failed" ? "Inspection saved. Email delivery failed; see the delivery notice for details." : "Inspection submitted. Project notification accepted by the mail server.", `/inspections/${result.id}`);
    } catch { setError("Connection failed. Please try again."); setBusy(false); }
  }

  return <form className="card" onSubmit={submit}>
    <div className="notice">Select the project, category, one or more subcategories, then add photographs before submitting.</div>
    <div className="formgrid">
      <div className="field"><label>Project</label><select name="projectId" required><option value="">Select project</option>{projects.map((project) => <option key={project.id} value={project.id}>{project.code} — {project.name}</option>)}</select></div>
      <div className="field"><label>Location / Area</label><input name="location" required maxLength={200} placeholder="e.g. Tower A, Level 4" /></div>
      <div className="field"><label>Category</label><select name="categoryId" required value={categoryId} onChange={(event) => { setCategoryId(event.target.value); setSelected([]); }}><option value="">Select category</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></div>
      <div className="field"><label>Subcategories</label><div className="checkbox-list">{subcategories.map((subcategory: any) => <label key={subcategory.id}><input type="checkbox" name="subcategoryIds" value={subcategory.id} checked={selected.includes(subcategory.id)} onChange={(event) => setSelected(event.target.checked ? [...selected, subcategory.id] : selected.filter((id) => id !== subcategory.id))} /> {subcategory.name}</label>)}</div><small className="muted">Select all that apply. Each selected subcategory gets its own evidence upload.</small></div>
      <div className="field span2"><label>Inspection Description / Contractor Review</label><textarea name="description" rows={5} required minLength={3} placeholder="Describe the work inspected and observations…" /></div>
      {selected.length > 0 && <div className="field span2"><label>Evidence by subcategory</label><div className="subcategory-evidence">{subcategories.filter((subcategory: any) => selected.includes(subcategory.id)).map((subcategory: any) => <PhotoPicker key={subcategory.id} name={`photos_${subcategory.id}`} label={subcategory.name} />)}</div></div>}
    </div>
    {error && <p className="error">{error}</p>}
    <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "flex-end", gap: 10 }}><button type="button" className="btn btn-secondary" onClick={() => history.back()}>Cancel</button><button className="btn btn-primary" disabled={busy}>{busy ? "Uploading & submitting…" : "Review & Submit Inspection"}</button></div>
  </form>;
}
