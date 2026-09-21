"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, useId } from "react";
import { LayoutDashboard, ClipboardCheck, Search, UsersRound, Building2, Layers3, FolderKanban, Mail, FileText, UserRound, Menu, X, ArrowUpRight, PanelLeftClose, PanelLeftOpen } from "lucide-react";
export function WorkspaceNavigation({ role, base }: { role: string; base: string }) {
  const pathname = usePathname();
  const [expanded, setExpanded] = useState(true);
  const railId = useId();
  useEffect(() => {
    try { const saved = localStorage.getItem("inspectifier-menu-expanded"); if (saved !== null) setExpanded(saved === "true"); } catch { /* Use the expanded default when storage is unavailable. */ }
  }, []);
  function toggleExpanded() {
    const next = !expanded;
    setExpanded(next);
    try { localStorage.setItem("inspectifier-menu-expanded", String(next)); } catch { /* The toggle still works without storage. */ }
  }
  const drawer = useRef<HTMLDialogElement>(null);
  useEffect(() => { drawer.current?.close(); }, [pathname]);
  useEffect(() => {
    const desktop = window.matchMedia("(min-width: 761px)");
    const closeOnDesktop = () => { if (desktop.matches) drawer.current?.close(); };
    desktop.addEventListener("change", closeOnDesktop);
    return () => desktop.removeEventListener("change", closeOnDesktop);
  }, []);
  const links = [
    { href: base, label: "Overview", icon: LayoutDashboard },
    { href: "/inspections", label: "Inspections", icon: ClipboardCheck },
    { href: "/search", label: "Search", icon: Search },
    ...(role === "ADMIN" ? [
      { href: "/admin/master", label: "Projects", icon: FolderKanban },
      { href: "/admin/users", label: "Users", icon: UsersRound },
      { href: "/admin/allocations", label: "Project allocation", icon: ArrowUpRight },
      { href: "/admin/companies", label: "Companies", icon: Building2 },
      { href: "/admin/categories", label: "Categories", icon: Layers3 },
      { href: "/admin/workflow", label: "Email delivery", icon: Mail }
    ] : []),
    { href: "/reports", label: "Reports", icon: FileText },
    { href: "/profile", label: "My profile", icon: UserRound }
  ];
  const navigation = <nav className="workspace-links" aria-label="Workspace">{links.map(({ href, label, icon: Icon }) => <Link key={href} href={href} title={label} aria-current={(href === base ? pathname === href : pathname === href || pathname.startsWith(href + "/")) ? "page" : undefined} onClick={() => drawer.current?.close()}><Icon size={20} /><span>{label}</span></Link>)}</nav>;
  return <><aside id={railId} className="workspace-rail" data-expanded={expanded}>
      <Link className="rail-logo" href={base} aria-label="Inspectifier home"><span className="rail-symbol">i<span>•</span></span><span className="rail-brand-text">Inspectifier</span></Link>
      <button type="button" className="rail-toggle" onClick={toggleExpanded} aria-expanded={expanded} aria-controls={railId} aria-label={expanded ? "Collapse menu" : "Expand menu"} title={expanded ? "Collapse menu" : "Expand menu"}>
        {expanded ? <PanelLeftClose size={19} /> : <PanelLeftOpen size={19} />}<span>{expanded ? "Collapse menu" : "Expand"}</span>
      </button>
      {navigation}<span className="rail-footer">{expanded ? "CUBIXTOP INDIA" : "IF"}</span></aside>
    <button type="button" className="mobile-menu-button iconbtn" aria-label="Open navigation" onClick={() => drawer.current?.showModal()}><Menu size={21} /></button>
    <dialog ref={drawer} className="mobile-drawer" aria-label="Main navigation"><div className="drawer-heading"><strong>Inspectifier</strong><button className="iconbtn" aria-label="Close navigation" onClick={() => drawer.current?.close()}><X size={20} /></button></div>{navigation}</dialog>
  </>;
}
