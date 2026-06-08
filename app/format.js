import {
  BEIJING_TIME_ZONE,
  createBeijingFormatter,
  parseInstant,
} from "../lib/beijing-time.js";

export { BEIJING_TIME_ZONE };

export function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export function formatTimestamp(date) {
  return createBeijingFormatter({
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(date);
}

export function formatConfidence(value) {
  return value === "high" ? "高置信" : value === "medium" ? "中置信" : "低置信";
}

export function formatRegion(value) {
  return value === "CN" ? "中文区" : value === "Global" ? "海外" : value;
}

export function formatMode(mode) {
  const map = {
    mock: "模拟数据",
    file: "文件数据",
    real: "真实数据",
    real_fallback_mock: "真实回退模拟",
    real_unconfigured_fallback_mock: "未配置回退模拟",
  };
  return map[mode] || mode;
}

export function formatKickoff(value) {
  const parsed = parseInstant(value);
  if (!parsed) {
    return value;
  }

  return createBeijingFormatter({
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(parsed);
}

export function formatMatchdayKey(value) {
  const parsed = parseInstant(value);
  if (!parsed) {
    return "时间待定";
  }

  return createBeijingFormatter({
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
  }).format(parsed);
}

export function formatDateGroupHeader(value) {
  const parsed = parseInstant(value);
  if (!parsed) {
    return "时间待定";
  }

  return createBeijingFormatter({
    weekday: "short",
    month: "long",
    day: "numeric",
  }).format(parsed);
}
