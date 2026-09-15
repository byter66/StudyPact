const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "";

export async function apiRequest(path, options = {}) {
  const session = localStorage.getItem("studypact-session");
  const parsedSession = session ? JSON.parse(session) : null;

  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {}),
  };

  if (parsedSession?.access_token) {
    headers.Authorization = `Bearer ${parsedSession.access_token}`;
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.message || "Request failed.");
  }

  return data;
}
