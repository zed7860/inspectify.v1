import { requireUser } from "@/lib/auth/guard";
import { AppShell } from "@/components/app-shell";

export default async function Page() {
  const u = await requireUser(["ADMIN", "SUPER_ADMIN"]);

  return (
    <AppShell user={u.profile}>
      <div className="pagehead">
        <div>
          <h1>Reports</h1>
          <p className="muted">Inspection register and export-ready reporting views.</p>
        </div>
      </div>

      <div className="stats">
        <div className="stat">
          <span>Format</span>
          <strong>Excel</strong>
        </div>
        <div className="stat">
          <span>Format</span>
          <strong>CSV</strong>
        </div>
        <div className="stat">
          <span>Format</span>
          <strong>PDF</strong>
        </div>
      </div>

      <div className="card">
        <h2>Inspection Register</h2>
        <p className="muted">Export the approved inspection lifecycle and audit events in standard file formats.</p>
        <div className="row-actions" style={{ marginTop: 18 }}>
          <a className="btn btn-primary" href="/api/reports?format=xlsx">Excel (.xlsx)</a>
          <a className="btn btn-secondary" href="/api/reports?format=csv">CSV</a>
          <a className="btn btn-secondary" href="/api/reports?format=pdf">PDF</a>
        </div>
      </div>
    </AppShell>
  );
}
