const API_BASE = "https://wit-backend-pu4g.onrender.com";

async function parseJsonOrText(response) {
  const text = await response.text();

  try {
    return JSON.parse(text);
  } catch {
    return { detail: text || `HTTP ${response.status}` };
  }
}

async function apiGet(path) {
  const response = await fetch(`${API_BASE}${path}`);
  const data = await parseJsonOrText(response);

  if (!response.ok) {
    throw new Error(data.detail || `HTTP ${response.status}`);
  }

  return data;
}

async function apiPost(path, body) {
  const response = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });

  const data = await parseJsonOrText(response);

  if (!response.ok) {
    throw new Error(data.detail || `HTTP ${response.status}`);
  }

  return data;
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  (async () => {
    try {
      if (message.type === "WIT_HEALTH") {
        const data = await apiGet("/health");
        sendResponse({ ok: true, data });
        return;
      }

      if (message.type === "WIT_SEARCH_ADDRESS") {
        const query = encodeURIComponent(message.query || "");
        const data = await apiGet(`/api/search-address?query=${query}`);
        sendResponse({ ok: true, data });
        return;
      }

      if (message.type === "WIT_ROUTE") {
        const data = await apiPost("/api/route", message.payload);
        sendResponse({ ok: true, data });
        return;
      }

      sendResponse({
        ok: false,
        error: "알 수 없는 WiT 메시지입니다."
      });
    } catch (error) {
      console.error("[WiT background]", error);

      sendResponse({
        ok: false,
        error: error?.message || String(error)
      });
    }
  })();

  return true;
});
