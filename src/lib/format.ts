const WD = ["日", "月", "火", "水", "木", "金", "土"];

export function weekday(date: string) {
  const d = new Date(`${date}T00:00:00`);
  return Number.isNaN(d.getTime()) ? "" : WD[d.getDay()];
}

/** 2026/10/09（金） */
export function slashDate(date: string) {
  if (!date) return "日付未設定";
  return `${date.replaceAll("-", "/")}（${weekday(date)}）`;
}

/** 2026年10月9日（金） */
export function jpDate(date: string) {
  if (!date) return "";
  const [y, m, d] = date.split("-").map(Number);
  return `${y}年${m}月${d}日（${weekday(date)}）`;
}

export function minutesBetween(start: string, end: string) {
  if (!start || !end) return null;
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  const diff = eh * 60 + em - (sh * 60 + sm);
  return diff > 0 ? diff : null;
}

export function timeRange(start: string, end: string) {
  if (!start && !end) return "";
  const mins = minutesBetween(start, end);
  return `${start || "--:--"} 〜 ${end || "--:--"}${mins ? `（${mins}分）` : ""}`;
}

export function clock(sec: number) {
  const s = Math.max(0, Math.floor(sec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}`;
}

export function safeFileName(m: { heldOn: string; round: number | null; id: string }) {
  return `担当者会議議事録_${m.heldOn.replaceAll("-", "")}${m.round ? `_第${m.round}回` : ""}_${m.id.slice(0, 6)}`;
}
