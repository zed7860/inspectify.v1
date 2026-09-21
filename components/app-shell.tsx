import { WorkspaceNavigation } from "@/components/workspace-navigation";
import { AdminForm } from "@/components/admin-form";
import Link from "next/link";
import { Bell, Building2, ClipboardCheck, FileText, FolderKanban, Home, Layers3, LogOut, Mail, Search, UserRound } from "lucide-react";
import type { ReactNode } from "react";

export function AppShell({ user, children }: { user: any; children: ReactNode }) {
  const role = user?.role || "ADMIN";
  const base = role === "CONTRACTOR" ? "/contractor" : role === "PMC" ? "/pmc" : role === "CLIENT" ? "/client" : "/admin";

  return (
    <div className="app-shell">
      <WorkspaceNavigation role={role} base={base} />
      <main className="main-panel">
        <header className="topbar">
          <Link href={base} className="workspace-brand">Inspectifier<span>PROJECT WORKSPACE</span></Link>
          <form action="/inspections" className="topbar-search"><Search size={17} /><input name="search" placeholder="Search inspections…" aria-label="Search inspection number" /><kbd>↵</kbd></form>
          <div className="head-actions">
            <Link href="/profile" className="account-pill"><span className="account-avatar">{user?.name?.slice(0, 1).toUpperCase() || "U"}</span><span><b>{user?.name || "User"}</b><small>{role === "ADMIN" ? "Workspace admin" : role.toLowerCase()}</small></span></Link>
            <Link href="/notifications" aria-label="Notifications">
              <Bell size={18} />
            </Link>
            <AdminForm action="/api/auth/logout" method="post" successMessage="Signed out successfully.">
              <button className="iconbtn" aria-label="Logout">
                <LogOut size={18} />
              </button>
            </AdminForm>
          </div>
        </header>

        <div className="content">{children}</div>

        <nav className="bottomnav">
          <Link href={base}><Home size={18} /><span>Home</span></Link>
          <Link href="/inspections"><ClipboardCheck size={18} /><span>Inspections</span></Link>
          {role === 'CONTRACTOR' ? (
            <Link href="/inspections/new" className="primary"><b>＋</b><span>New</span></Link>
          ) : (
            <Link href="/inspections?status=pending" className="primary"><b>✓</b><span>Pending</span></Link>
          )}
          <Link href="/notifications"><Bell size={18} /><span>Alerts</span></Link>
          <Link href="/profile"><UserRound size={18} /><span>Profile</span></Link>
        </nav>
      </main>
    </div>
  );
}

export function Stat({ label, value, sub }: { label: string; value: number | string; sub?: string }) {
  return (
    <div className="stat">
      <span>{label}</span>
      <strong>{value}</strong>
      {sub && <small>{sub}</small>}
    </div>
  );
}

export function StatusBadge({ status }: { status: string }) {
  return <span className={`badge ${status.toLowerCase()}`}>{status.replaceAll('_', ' ')}</span>;
}

export function Empty({ title = 'No inspections waiting for review', body = "You're all caught up." }: { title?: string; body?: string }) {
  return (
    <div className="empty">
      <ClipboardCheck size={42} />
      <h3>{title}</h3>
      <p>{body}</p>
    </div>
  );
}

