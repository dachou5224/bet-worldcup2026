import { computeDisagreement, computeConfidenceScore } from "./metrics.js";
import { formatMatchdayKey } from "./format.js";

const PREMATCH_STATUSES = new Set(["赛前", "已定时", "数据准备", "scheduled", "timed"]);
const FINISHED_STATUSES = new Set(["完场", "已结束", "finished", "已完赛"]);

export function filterLiveMatches(matches, liveFilter) {
  if (liveFilter === "prematch") {
    return matches.filter((match) => PREMATCH_STATUSES.has(match.status));
  }
  if (liveFilter === "finished") {
    return matches.filter((match) => FINISHED_STATUSES.has(match.status));
  }
  return matches.slice(0, 14);
}

export function filterPredictions(predictions, filters, now = new Date()) {
  let items = [...predictions];

  if (filters.matchday) {
    items = items.filter((item) => formatMatchdayKey(item.kickoff) === filters.matchday);
  }

  if (filters.when === "today") {
    items = items.filter((item) => isSameDay(item.kickoff, now));
  } else if (filters.when === "tomorrow") {
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    items = items.filter((item) => isSameDay(item.kickoff, tomorrow));
  } else if (filters.when === "48h") {
    const end = new Date(now);
    end.setHours(end.getHours() + 48);
    items = items.filter((item) => {
      const kickoff = new Date(item.kickoff);
      return !Number.isNaN(kickoff.getTime()) && kickoff >= now && kickoff <= end;
    });
  }

  if (filters.view === "recommended") {
    items = items.filter((item) => item.confidence !== "low" || computeDisagreement(item) >= 4);
  } else if (filters.view === "edge5") {
    items = items.filter((item) => computeDisagreement(item) >= 5);
  }

  if (filters.sort === "edge") {
    items.sort((a, b) => computeDisagreement(b) - computeDisagreement(a));
  } else if (filters.sort === "date") {
    items.sort((a, b) => new Date(a.kickoff) - new Date(b.kickoff));
  } else {
    items.sort((a, b) => computeConfidenceScore(b) - computeConfidenceScore(a));
  }

  return items;
}

function isSameDay(value, date) {
  const kickoff = new Date(value);
  if (Number.isNaN(kickoff.getTime())) {
    return false;
  }
  return (
    kickoff.getFullYear() === date.getFullYear() &&
    kickoff.getMonth() === date.getMonth() &&
    kickoff.getDate() === date.getDate()
  );
}

export function buildMatchdayBuckets(predictions) {
  const buckets = new Map();

  for (const item of predictions) {
    const key = formatMatchdayKey(item.kickoff);
    const current = buckets.get(key) || { key, count: 0, lowConfidence: 0 };
    current.count += 1;
    if (item.confidence === "low") {
      current.lowConfidence += 1;
    }
    buckets.set(key, current);
  }

  return Array.from(buckets.values()).slice(0, 8);
}

export function groupMatchesByDate(matches) {
  const groups = new Map();

  for (const match of matches) {
    const key = match.kickoff || "unknown";
    const list = groups.get(key) || [];
    list.push(match);
    groups.set(key, list);
  }

  return [...groups.entries()].sort(([a], [b]) => new Date(a) - new Date(b));
}
