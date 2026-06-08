/** 全站展示与分组统一使用北京时间（UTC+8） */
export const BEIJING_TIME_ZONE = "Asia/Shanghai";

const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function parseInstant(value) {
  const parsed = value instanceof Date ? value : new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/** 将时刻格式化为北京时间日历日 YYYY-MM-DD */
export function beijingDateKey(value) {
  if (typeof value === "string" && DATE_KEY_PATTERN.test(value.trim())) {
    return value.trim();
  }

  const parsed = parseInstant(value);
  if (!parsed) {
    return null;
  }

  return new Intl.DateTimeFormat("en-CA", {
    timeZone: BEIJING_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(parsed);
}

export function addCalendarDays(dateKey, days) {
  const [year, month, day] = dateKey.split("-").map(Number);
  const next = new Date(Date.UTC(year, month - 1, day + days));
  return next.toISOString().slice(0, 10);
}

export function isSameBeijingDay(left, right) {
  const leftKey = beijingDateKey(left);
  const rightKey = beijingDateKey(right);
  return leftKey != null && leftKey === rightKey;
}

export function createBeijingFormatter(options) {
  return new Intl.DateTimeFormat("zh-CN", {
    ...options,
    timeZone: BEIJING_TIME_ZONE,
  });
}
