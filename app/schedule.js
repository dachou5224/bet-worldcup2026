import { computeDisagreement, computeConfidenceScore, summarizeLean } from "./metrics.js";

const FINISHED_STATUSES = new Set(["完场", "已结束", "finished", "已完赛"]);

function parseKickoff(value) {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

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

const FALLBACK_DAY_COUNT = 14;

function sortSpotlightMatches(matches) {
  return [...matches].sort((a, b) => {
    const scoreDiff = scoreSpotlightMatch(b) - scoreSpotlightMatch(a);
    if (Math.abs(scoreDiff) > 0.01) {
      return scoreDiff;
    }
    return new Date(a.kickoff) - new Date(b.kickoff);
  });
}

function pickFromWindow(unifiedMatches, now, dayCount, limit) {
  return sortSpotlightMatches(
    unifiedMatches.filter(
      (match) =>
        isWithinUpcomingWindow(match.kickoff, now, dayCount) && !FINISHED_STATUSES.has(match.status),
    ),
  ).slice(0, limit);
}

export function pickSpotlightMatches(unifiedMatches, now = new Date(), dayCount = 3, limit = 8) {
  const primary = pickFromWindow(unifiedMatches, now, dayCount, limit);
  if (primary.length) {
    return { matches: primary, meta: { mode: "primary", windowDays: dayCount } };
  }

  const fallback = pickFromWindow(unifiedMatches, now, FALLBACK_DAY_COUNT, limit);
  if (fallback.length) {
    return {
      matches: fallback,
      meta: { mode: "fallback", windowDays: dayCount, fallbackDays: FALLBACK_DAY_COUNT },
    };
  }

  const nearest = sortSpotlightMatches(
    unifiedMatches.filter((match) => {
      const kickoff = parseKickoff(match.kickoff);
      return kickoff && kickoff >= now && !FINISHED_STATUSES.has(match.status);
    }),
  ).slice(0, limit);

  return { matches: nearest, meta: { mode: "nearest", windowDays: dayCount } };
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

    const dayStart = new Date(kickoff);
    dayStart.setHours(0, 0, 0, 0);
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const diffDays = Math.round((dayStart - todayStart) / (24 * 60 * 60 * 1000));

    let label;
    if (diffDays === 0) {
      label = "今天";
    } else if (diffDays === 1) {
      label = "明天";
    } else if (diffDays === 2) {
      label = "后天";
    } else {
      label = new Intl.DateTimeFormat("zh-CN", {
        month: "2-digit",
        day: "2-digit",
        weekday: "short",
      }).format(kickoff);
    }

    const list = buckets.get(label) || [];
    list.push(match);
    buckets.set(label, list);
  }

  return [...buckets.entries()];
}
