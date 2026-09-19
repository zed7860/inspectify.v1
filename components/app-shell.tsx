import Link from "next/link";
import { Bell, Building2, ClipboardCheck, FileText, FolderKanban, Home, Layers3, LogOut, Mail, Search, UserRound } from "lucide-react";
import type { ReactNode } from "react";

export function AppShell({ user, children }: { user: any; children: ReactNode }) {
  const role = user?.role || "ADMIN";
  const base = role === "CONTRACTOR" ? "/contractor" : role === "PMC" ? "/pmc" : role === "CLIENT" ? "/client" : "/admin";

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Link href={base} className="brand">
          <span className="brandmark">SI</span>
          <span>Inspectifier</span>
        </Link>

        <nav className="sidebar-nav">
          <Link href={base}><Home size={16} /> Dashboard</Link>
          <Link href="/inspections"><ClipboardCheck size={16} /> Inspections</Link>
          <Link href="/search"><Search size={16} /> Search</Link>
          {role === 'ADMIN' && (
            <>
              <Link href="/admin/users"><UserRound size={16} /> Users</Link>
              <Link href="/admin/companies"><Building2 size={16} /> Companies</Link>
              <Link href="/admin/categories"><Layers3 size={16} /> Inspection categories</Link>
              <Link href="/admin/master"><FolderKanban size={16} /> Projects</Link>
              <Link href="/admin/workflow"><Mail size={16} /> Workflow delivery</Link>
            </>
          )}
          <Link href="/reports"><FileText size={16} /> Reports</Link>
          <Link href="/profile"><UserRound size={16} /> Profile</Link>
        </nav>

        <div className="sidefoot">
          <small>{user?.name || 'User'}</small>
          <small>{String(role).replaceAll('_', ' ')}</small>
        </div>
      </aside>

      <main className="main-panel">
        <header className="topbar">
          <Link href="/profile" className="topbar-user">
            <b>{user?.name || 'User'}</b>
            <span className="muted">
              {' '}
              · {String(role).replaceAll('_', ' ')}
              {user?.company?.name ? ` · ${user.company.name}` : ''}
            </span>
          </Link>

          <div className="head-actions">
            <Link href="/notifications" aria-label="Notifications">
              <Bell size={18} />
            </Link>
            <form action="/api/auth/logout" method="post">
              <button className="iconbtn" aria-label="Logout">
                <LogOut size={18} />
              </button>
            </form>
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

