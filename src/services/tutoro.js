import { API_BASE, TOKEN, TUTORO_PHONE, TUTORO_PASSWORD, DEVICE_ID, FIREBASE_TOKEN, setToken } from "../config/index.js";
import { getTodayStr } from "../utils/time.js";

let loginPromise = null;

/** Đăng nhập tự động để lấy Token */
export async function login() {
  if (loginPromise) return loginPromise;

  loginPromise = (async () => {
    if (!TUTORO_PHONE || !TUTORO_PASSWORD) {
      throw new Error("Không có thông tin đăng nhập TUTORO_PHONE và TUTORO_PASSWORD trong file .env");
    }
    
    console.log("[LOGIN] Dang tien hanh dang nhap tu dong...");
    try {
      const res = await fetch(`${API_BASE}/user/login_pass`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mobile_number: TUTORO_PHONE,
          password: TUTORO_PASSWORD,
          device_id: DEVICE_ID,
          firebase_token: FIREBASE_TOKEN
        })
      });
      const data = await res.json();
      if (data.message?.status_code === 200 && data.data?.token) {
        setToken(data.data.token);
        console.log("[LOGIN] Dang nhap thanh cong! Da lay token moi.");
        return data.data.token;
      } else {
        throw new Error(data.message?.text || "Dang nhap that bai");
      }
    } catch (err) {
      console.error("[LOGIN] Loi dang nhap:", err.message);
      throw err;
    } finally {
      loginPromise = null;
    }
  })();

  return loginPromise;
}

/** Gọi API TutorO (có retry và auto-login) */
export async function callApi(method, path, body = null, retries = 3) {
  const url = `${API_BASE}${path}`;

  // Đảm bảo có token trước khi gọi
  let currentToken = TOKEN;
  if (!currentToken) {
    currentToken = await login();
  }

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const options = {
        method,
        headers: {
          Authorization: `Bearer ${currentToken}`,
          "Content-Type": "application/json",
        },
      };
      
      if (body) {
        options.body = JSON.stringify(body);
      }

      const res = await fetch(url, options);

      // Nếu lỗi 401 Unauthorized -> Hết hạn Token -> Đăng nhập lại
      if (res.status === 401) {
        console.log(`[API] Token het han hoac khong hop le (401). Dang dang nhap lai...`);
        currentToken = await login();
        continue; // Thử lại request hiện tại bằng token mới
      }

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
      if (attempt < retries) {
        console.log(`   [RETRY] Thu lai sau 5 giay...`);
        const { sleep } = await import("../utils/time.js");
        await sleep(5000);
      } else {
        throw err;
      }
    }
  }
}

/** Lấy danh sách lớp học hôm nay */
export async function getSessionsToday() {

  const todayStr = getTodayStr();
  const path = `/class_sessions?from_date=${todayStr}&to_date=${todayStr}`;
  const json = await callApi("GET", path);
  return json.data?.list_sessions || [];
}

/** Kiểm tra trạng thái check-in của 1 buổi */
export async function getCheckinStatus(sessionId) {
  try {
    const json = await callApi("GET", `/class_sessions/${sessionId}/checkin`);
    if (json.message?.status_code === 200 && json.data?.checkin_id) {
      return json.data; // { checkin_id, checkin_datetime, state, note }
    }
    return null;
  } catch {
    return null;
  }
}

/** Lấy danh sách học sinh để đánh giá */
export async function getEvaluationStudents(sessionId) {
  try {
    const json = await callApi("GET", `/class_sessions/${sessionId}/evaluations`);
    if (json.data?.list_evaluations?.length > 0) {
      return json.data.list_evaluations[0].list_students || [];
    }
    return [];
  } catch (err) {
    console.error(`[API] Loi lay danh sach hs de danh gia:`, err.message);
    return [];
  }
}

/** Submit đánh giá cho học sinh */
export async function submitEvaluation(sessionId, studentId, payload) {
  try {
    const json = await callApi("POST", `/class_sessions/${sessionId}/evaluations/${studentId}`, payload);
    return json.message?.status_code === 200;
  } catch (err) {
    console.error(`[API] Loi submit danh gia cho hs ${studentId}:`, err.message);
    return false;
  }
}

/** Lấy danh sách ID học sinh nghỉ học (attendance_status !== "YES") */
export async function getAbsentStudentIds(sessionId) {
  try {
    const json = await callApi("GET", `/class_sessions/${sessionId}/attendances?language_code=vi`);
    const absentIds = new Set();
    const centers = json.data?.list_students || [];
    for (const center of centers) {
      for (const student of (center.list_students || [])) {
        if (student.attendance_status !== "YES") {
          absentIds.add(student.student_id);
        }
      }
    }
    return absentIds;
  } catch (err) {
    console.error(`[API] Loi lay danh sach diem danh:`, err.message);
    return new Set(); // Nếu lỗi, trả về rỗng (không bỏ qua ai)
  }
}

