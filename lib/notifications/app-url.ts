export function publicAppUrl(value: string) {
  let url: URL;
  try { url = new URL(value); } catch { throw new Error("Set the public website URL in Workflow delivery before sending inspection emails."); }
  const host = url.hostname.toLowerCase();
  if (url.protocol !== "https:" || url.username || url.password || host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || host === "[::1]" || /^(127\.|10\.|192\.168\.|0\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.)/.test(host) || url.search || url.hash || url.pathname !== "/") throw new Error("Use the public HTTPS website address, without a path, query or localhost.");
  return url.origin;
}
export function inspectionReturnPath(value: string) {
  return /^\/inspections\/[0-9a-f-]{36}$/i.test(value) ? value : "";
}
