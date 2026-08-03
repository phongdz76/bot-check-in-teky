/** Chuyển phút từ 0:00 sang chuỗi "HH:MM" */
export function minutesToTimeStr(minutes) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** Lấy ngày hôm nay theo format DD-MM-YYYY */
export function getTodayStr() {
  const now = new Date();
  const dd = String(now.getDate()).padStart(2, "0");
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const yyyy = now.getFullYear();
  return `${dd}-${mm}-${yyyy}`;
}

/** Lấy số phút hiện tại kể từ 0:00 */
export function getCurrentMinutes() {
  const now = new Date();
  return now.getHours() * 60 + now.getMinutes();
}

/** Sleep ms */
export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Tính số ms từ bây giờ đến 6:00 sáng hôm sau */
export function msUntilTomorrow6AM() {
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(6, 0, 0, 0); // 6:00 sáng hôm sau
  return tomorrow.getTime() - now.getTime();
}

/** Format ms thành chuỗi dễ đọc */
export function formatDuration(ms) {
  const totalMinutes = Math.floor(ms / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours > 0) return `${hours} tiếng ${minutes} phút`;
  return `${minutes} phút`;
}


