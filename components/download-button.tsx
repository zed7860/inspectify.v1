"use client";
import { useState } from "react";
import { notifySuccess } from "@/components/action-feedback";
export function DownloadButton({ href, filename, children, disabled = false }: { href: string; filename: string; children: React.ReactNode; disabled?: boolean }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return <><button type="button" className="btn btn-secondary" disabled={disabled || busy} onClick={async () => {
    setBusy(true); setError("");
    try {
      const response = await fetch(href);
      if (!response.ok || response.headers.get("content-type")?.includes("text/html")) throw new Error("Unable to download. Please sign in and try again.");
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a"); link.href = url; link.download = filename;
      document.body.appendChild(link); link.click(); link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 30000);
      notifySuccess("File prepared successfully. Download started.");
    } catch (error) { setError(error instanceof Error ? error.message : "Download failed."); }
    finally { setBusy(false); }
  }}>{busy ? "Preparing download…" : children}</button>{error && <p className="error" role="alert">{error}</p>}</>;
}
