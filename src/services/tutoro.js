const { API_BASE, TOKEN } = require("../config");

/** Gọi API TutorO (có retry) */
async function callApi(method, path, retries = 3) {
  const url = `${API_BASE}${path}`;

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, {
        method,
        headers: {
          Authorization: `Bearer ${TOKEN}`,
        },
      });

      const text = await res.text();

      // WAF hoặc server trả HTML thay vì JSON
      if (text.startsWith("<!DOCTYPE") || text.startsWith("<html")) {
        throw new Error(`Server trả HTML (WAF chặn hoặc lỗi server)`);
      }

      const json = JSON.parse(text);

      if (!res.ok || json.message?.status_code !== 200) {
        throw new Error(
          `API lỗi [${res.status}]: ${json.message?.text || JSON.stringify(json)}`
        );
      }

      return json;
    } catch (err) {
      console.log(`   [CANH BAO] Lan ${attempt}/${retries}: ${err.message}`);
      if (attempt < retries) {
        await new Promise((resolve) => setTimeout(resolve, 5000));
      } else {
        throw err;
      }
    }
  }
}

/** Lấy danh sách lớp học hôm nay */
async function getSessionsToday() {
  const { getTodayStr } = require("../utils/time");
  const todayStr = getTodayStr();
  const path = `/class_sessions?from_date=${todayStr}&to_date=${todayStr}`;
  const json = await callApi("GET", path);
  return json.data?.list_sessions || [];
}

/** Kiểm tra trạng thái check-in của 1 buổi */
async function getCheckinStatus(sessionId) {
  try {
    const res = await fetch(`${API_BASE}/class_sessions/${sessionId}/checkin`, {
      method: "GET",
      headers: { Authorization: `Bearer ${TOKEN}` },
    });
    const json = await res.json();
    if (json.message?.status_code === 200 && json.data?.checkin_id) {
      return json.data; // { checkin_id, checkin_datetime, state, note }
    }
    return null;
  } catch {
    return null;
  }
}

module.exports = {
  callApi,
  getSessionsToday,
  getCheckinStatus,
};
