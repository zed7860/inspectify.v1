"use client";

import { useState } from "react";

export function WorkflowDeliveryForm({ smtp, saveStatus, saveReason }: { smtp: Record<string, any>; saveStatus: string; saveReason: string }) {
  const [recipient, setRecipient] = useState("");
  const [testing, setTesting] = useState(false);
  const [message, setMessage] = useState("");

  async function sendTest(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setTesting(true);
    setMessage("");
    const response = await fetch("/api/admin/workflow", { method: "POST", body: new FormData(event.currentTarget) });
    const result = await response.json();
    setMessage(response.ok ? result.message : result.error || "Test email failed.");
    setTesting(false);
  }

  return <>
    <section className="card">
      <p className="eyebrow">Workflow delivery</p>
      <h1>SMTP email settings</h1>
      <p className="muted">Configure the sender used for inspection submissions, approvals, rejections, resubmissions, and reports.</p>
      {saveStatus === "sent" && <p className="success">SMTP configured successfully. A test email was sent to {smtp.from}.</p>}
      {saveStatus === "failed" && <p className="error">SMTP settings were saved, but the automatic test email failed: {saveReason === "auth" ? "Google rejected the login. Use a Google App Password." : saveReason === "unreachable" ? "The SMTP host or port is unreachable from this server." : "Check the SMTP host, port, sender address, and network access."}</p>}
      <form className="formgrid" action="/api/admin/workflow" method="post">
        <input type="hidden" name="action" value="save" />
        <div className="field"><label>SMTP host</label><input name="host" defaultValue={smtp.host || ""} placeholder="smtp.example.com" required /></div>
        <div className="field"><label>Port</label><input name="port" type="number" defaultValue={smtp.port || 587} required /></div>
        <div className="field"><label>SMTP username</label><input name="user" defaultValue={smtp.user || ""} required /></div>
        <div className="field"><label>SMTP password</label><input name="password" type="password" placeholder={smtp.password ? "Leave blank to keep current password" : "Password"} /></div>
        <div className="field"><label>From email</label><input name="from" type="email" defaultValue={smtp.from || ""} placeholder="inspections@example.com" required /></div>
        <label className="field"><span>Secure connection</span><input name="secure" type="checkbox" defaultChecked={smtp.secure === true} /><small className="muted">Port 587: off. Port 465: on.</small></label>
        <button className="btn btn-primary">Save email settings</button>
      </form>
    </section>
    <section className="card">
      <p className="eyebrow">Connection check</p>
      <h2>Send a test email</h2>
      <p className="muted">Save the SMTP settings first, then enter an address to verify delivery.</p>
      <form className="formgrid" onSubmit={sendTest}>
        <input type="hidden" name="action" value="test" />
        <div className="field"><label htmlFor="test-recipient">Test recipient</label><input id="test-recipient" name="recipient" type="email" value={recipient} onChange={(event) => setRecipient(event.target.value)} placeholder="you@example.com" required /></div>
        <button className="btn btn-secondary" disabled={testing}>{testing ? "Sending…" : "Send test email"}</button>
        {message && <p className={message.startsWith("Test email sent") ? "success" : "error"}>{message}</p>}
      </form>
    </section>
  </>;
}
