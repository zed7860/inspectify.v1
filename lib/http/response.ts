export async function readJsonResponse(response: Response): Promise<any> {
  const body = await response.text();
  let result: any;
  try { result = body ? JSON.parse(body) : null; } catch { result = null; }
  if (result && typeof result === "object") return result;
  if (response.redirected || response.status === 401) throw new Error("Your session has expired. Sign in and try again.");
  if (response.status === 413) throw new Error("The request exceeds the hosting server's upload limit. Reduce the upload size and try again.");
  if ([502,503,504].includes(response.status)) throw new Error("The server could not finish the request. Check delivery status before retrying to avoid duplicate emails.");
  throw new Error(`The server returned an empty or invalid response (HTTP ${response.status}). Check the connection and try again.`);
}
