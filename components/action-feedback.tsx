"use client";
import { useEffect, useState } from "react";

export function notifySuccess(message: string) {
  window.dispatchEvent(new CustomEvent("action-success", { detail: message }));
}
export function finishAction(message: string, destination?: string) {
  try { sessionStorage.setItem("action-success", message); } catch { /* Navigation still works if storage is unavailable. */ }
  if (destination) location.assign(destination);
  else location.reload();
}
export function ActionFeedback() {
  const [message, setMessage] = useState("");
  useEffect(() => {
    try { const saved = sessionStorage.getItem("action-success"); sessionStorage.removeItem("action-success"); if (saved) setMessage(saved); } catch { /* Storage may be disabled. */ }
    const show = (event: Event) => setMessage((event as CustomEvent<string>).detail);
    window.addEventListener("action-success", show);
    return () => window.removeEventListener("action-success", show);
  }, []);
  useEffect(() => { if (!message) return; const timer = setTimeout(() => setMessage(""), 5000); return () => clearTimeout(timer); }, [message]);
  return message ? <div className="action-toast" role="status" aria-live="polite"><span>✓ {message}</span><button type="button" aria-label="Dismiss notification" onClick={() => setMessage("")}>×</button></div> : null;
}
