import { computeDisagreement, computeConfidenceScore, summarizeLean } from "./metrics.js";
import {
  addCalendarDays,
  beijingDateKey,
  createBeijingFormatter,
  parseInstant,
} from "../lib/beijing-time.js";

const FINISHED_STATUSES = new Set(["完场", "已结束", "finished", "已完赛"]);
const MS_PER_DAY = 24 * 60 * 60 * 1000;
const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function parseKickoff(value) {
  return parseInstant(value);
}

function toDateKey(value) {
  if (value instanceof Date) {
    return beijingDateKey(value);
  }

  const text = String(value || "").trim();
  if (DATE_KEY_PATTERN.test(text)) {
    return text;
  }

  return beijingDateKey(text);
}

export function parseDateOnly(value) {
  return toDateKey(value);
}

function addDaysToDateKey(dateKey, days) {
  return addCalendarDays(dateKey, days);
}

export function hasValidKickoff(value) {
  return parseKickoff(value) !== null;
}

export function getTournamentWeekCount(openingDate, endDate) {
  const opening = toDateKey(openingDate);
  const end = toDateKey(endDate);
  if (!opening || !end || end < opening) {
    return 1;
  }

  const openingTime = parseKickoff(`${opening}T00:00:00`);
  const endTime = parseKickoff(`${end}T00:00:00`);
  const spanDays = Math.floor((endTime - openingTime) / MS_PER_DAY) + 1;
  return Math.max(1, Math.ceil(spanDays / 7));
}

export function getWeekWindow(openingDate, weekIndex) {
  const opening = toDateKey(openingDate);
  if (!opening) {
    return { weekIndex: 0, weekStartKey: null, weekEndKey: null, weekStart: null, weekEnd: null };
  }

  const index = Math.max(0, weekIndex);
  const weekStartKey = addDaysToDateKey(opening, index * 7);
  const weekEndKey = addDaysToDateKey(weekStartKey, 7);

  return {
    weekIndex: index,
    weekStartKey,
    weekEndKey,
    weekStart: parseKickoff(`${weekStartKey}T00:00:00`),
    weekEnd: parseKickoff(`${weekEndKey}T00:00:00`),
  };
}

export function getDefaultWeekIndex(openingDate, endDate, now = new Date()) {
  const opening = toDateKey(openingDate);
  const end = toDateKey(endDate);
  const today = toDateKey(now);
  if (!opening || !today) {
    return 0;
  }

  if (today < opening) {
    return 0;
  }

  const lastWeekIndex = getTournamentWeekCount(openingDate, endDate) - 1;
  const openingTime = parseKickoff(`${opening}T00:00:00`);
  const todayTime = parseKickoff(`${today}T00:00:00`);
  const rawIndex = Math.floor((todayTime - openingTime) / (7 * MS_PER_DAY));
  return Math.min(lastWeekIndex, Math.max(0, rawIndex));
}

export function buildTournamentWeeks(openingDate, endDate) {
  const count = getTournamentWeekCount(openingDate, endDate);
  const formatter = createBeijingFormatter({ month: "numeric", day: "numeric" });

  return Array.from({ length: count }, (_, weekIndex) => {
    const { weekStartKey, weekEndKey, weekStart, weekEnd } = getWeekWindow(openingDate, weekIndex);
    const rangeEndKey = addDaysToDateKey(weekStartKey, 6);
    const rangeStartDate = parseKickoff(`${weekStartKey}T00:00:00`);
    const rangeEndDate = parseKickoff(`${rangeEndKey}T00:00:00`);
    return {
      weekIndex,
      weekNumber: weekIndex + 1,
      weekStartKey,
      weekEndKey,
      weekStart,
      weekEnd,
      label: `第 ${weekIndex + 1} 周`,
      rangeLabel: `${formatter.format(rangeStartDate)} – ${formatter.format(rangeEndDate)}`,
    };
  });
}

export function formatWeekHeading(week, { isCurrent = false } = {}) {
  const suffix = isCurrent ? "（本周）" : "";
  return `第 ${week.weekNumber} 周重点比赛${suffix}`;
}

export function scoreSpotlightMatch(match) {
  const prediction = match.prediction;
  let score = 0;

  if (match.kind === "live") {
    score += 12;
  }

  if (!FINISHED_STATUSES.has(match.status)) {
    score += 6;
  }

  if (prediction) {
    score += computeConfidenceScore(prediction) * 0.35;
    score += computeDisagreement(prediction) * 1.5;
    if (prediction.confidence === "low") {
      score += 8;
    }
  }

  if (/小组赛|开幕|1\/8|1-8|quarter|semi|final/i.test(`${match.stage || ""}`)) {
    score += 4;
  }

  return score;
}

function sortSpotlightMatches(matches) {
  return [...matches].sort((a, b) => {
    const scoreDiff = scoreSpotlightMatch(b) - scoreSpotlightMatch(a);
    if (Math.abs(scoreDiff) > 0.01) {
      return scoreDiff;
    }
    return new Date(a.kickoff) - new Date(b.kickoff);
  });
}

function isWithinWeek(kickoffValue, weekStartKey, weekEndKey) {
  const kickoffKey = toDateKey(kickoffValue);
  if (!kickoffKey || !weekStartKey || !weekEndKey) {
    return false;
  }
  return kickoffKey >= weekStartKey && kickoffKey < weekEndKey;
}

export function pickWeeklySpotlightMatches(
  unifiedMatches,
  {
    openingDate = "2026-06-11",
    endDate = "2026-07-19",
    weekIndex = null,
    now = new Date(),
    limit = 12,
  } = {},
) {
  const weeks = buildTournamentWeeks(openingDate, endDate);
  const defaultWeekIndex = getDefaultWeekIndex(openingDate, endDate, now);
  const selectedWeekIndex =
    weekIndex == null ? defaultWeekIndex : Math.min(weeks.length - 1, Math.max(0, weekIndex));
  const week = weeks[selectedWeekIndex] || weeks[0];
  const { weekStartKey, weekEndKey, weekStart, weekEnd } = week;

  const pool = unifiedMatches.filter(
    (match) =>
      hasValidKickoff(match.kickoff) &&
      isWithinWeek(match.kickoff, weekStartKey, week.weekEndKey) &&
      !FINISHED_STATUSES.has(match.status),
  );

  const matches = sortSpotlightMatches(pool).slice(0, limit);

  return {
    matches,
    meta: {
      mode: "weekly",
      openingDate,
      endDate,
      weekIndex: selectedWeekIndex,
      defaultWeekIndex,
      isCurrentWeek: selectedWeekIndex === defaultWeekIndex,
      weekNumber: week.weekNumber,
      weekStart,
      weekEnd,
      rangeLabel: week.rangeLabel,
      totalInWeek: pool.length,
    },
    weeks,
  };
}

/** @deprecated 保留旧名，内部走按周逻辑 */
export function pickSpotlightMatches(unifiedMatches, now = new Date(), _dayCount = 3, limit = 12) {
  return pickWeeklySpotlightMatches(unifiedMatches, { now, limit });
}

export function getSpotlightLeanLabel(match) {
  const prediction = match.prediction;
  if (!prediction) {
    return "暂无盘面";
  }

  const lean = summarizeLean(prediction, "market");
  const edge = computeDisagreement(prediction).toFixed(1);
  return `市场倾向 ${lean.label} ${lean.value}% · 分歧 ${edge}`;
}

export function buildSpotlightDayBuckets(matches, now = new Date()) {
  const buckets = new Map();

  for (const match of matches) {
    const kickoff = parseKickoff(match.kickoff);
    if (!kickoff) {
      continue;
    }

    const label = createBeijingFormatter({
      month: "numeric",
      day: "numeric",
      weekday: "short",
    }).format(kickoff);

    const list = buckets.get(label) || [];
    list.push(match);
    buckets.set(label, list);
  }

  return [...buckets.entries()];
}

export function buildFullScheduleGroups(unifiedMatches) {
  const groups = new Map();

  for (const match of unifiedMatches) {
    if (!hasValidKickoff(match.kickoff)) {
      continue;
    }
    const key = toDateKey(match.kickoff);
    const kickoff = parseKickoff(match.kickoff);
    const label = createBeijingFormatter({
      month: "long",
      day: "numeric",
      weekday: "long",
    }).format(kickoff);
    const bucket = groups.get(key) || { dateKey: key, label, matches: [] };
    bucket.matches.push(match);
    groups.set(key, bucket);
  }

  return [...groups.values()]
    .map((group) => ({
      ...group,
      matches: [...group.matches].sort((a, b) => new Date(a.kickoff) - new Date(b.kickoff)),
    }))
    .sort((a, b) => a.dateKey.localeCompare(b.dateKey));
}

// --- 兼容旧测试：仍保留「未来 N 天」窗口工具 ---
export function getUpcomingWindow(now = new Date(), dayCount = 3) {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);

  const end = new Date(start);
  end.setDate(end.getDate() + dayCount);

  return { start, end, now };
}

export function isWithinUpcomingWindow(kickoffValue, now = new Date(), dayCount = 3) {
  const kickoff = parseKickoff(kickoffValue);
  if (!kickoff) {
    return false;
  }

  const { start, end, now: current } = getUpcomingWindow(now, dayCount);
  return kickoff >= current && kickoff < end;
}
