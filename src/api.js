
const API_BASE = "http://localhost:5000";

export async function fetchAuditLogs({ from, to } = {}) {
  const params = new URLSearchParams();

  if (from) params.set("from", from);
  if (to) params.set("to", to);

  const query = params.toString();
  const url = `${API_BASE}/api/audit-logs${query ? `?${query}` : ""}`;

  const response = await fetch(url);

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.details || error.error || "Failed to fetch audit logs");
  }

  return response.json();
}
