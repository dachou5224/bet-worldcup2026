import test from "node:test";
import assert from "node:assert/strict";
import {
  buildFullScheduleGroups,
  buildTournamentWeeks,
  getDefaultWeekIndex,
  getWeekWindow,
  pickWeeklySpotlightMatches,
} from "../app/schedule.js";

const sampleMatches = [
  {
    kind: "prediction-only",
    id: 1,
    home: "Mexico",
    away: "Japan",
    kickoff: "2026-06-11T20:00:00-05:00",
    stage: "小组赛",
    status: "待开赛",
    fixture: "Mexico vs Japan",
    prediction: { id: 1, confidence: "high", marketHome: 40, marketDraw: 30, marketAway: 30, modelHome: 45, modelDraw: 28, modelAway: 27 },
  },
  {
    kind: "prediction-only",
    id: 2,
    home: "United States",
    away: "Morocco",
    kickoff: "2026-06-18T21:30:00-04:00",
    stage: "小组赛",
    status: "待开赛",
    fixture: "United States vs Morocco",
    prediction: { id: 2, confidence: "medium", marketHome: 38, marketDraw: 28, marketAway: 34, modelHome: 40, modelDraw: 27, modelAway: 33 },
  },
];

test("tournament weeks start from opening date", () => {
  const weeks = buildTournamentWeeks("2026-06-11", "2026-07-19");
  assert.ok(weeks.length >= 5);
  assert.equal(weeks[0].label, "第 1 周");
  assert.match(weeks[0].rangeLabel, /6\/11/);
});

test("default week before kickoff is week 1", () => {
  const now = new Date("2026-06-06T12:00:00Z");
  assert.equal(getDefaultWeekIndex("2026-06-11", "2026-07-19", now), 0);
});

test("pickWeeklySpotlightMatches groups opening week fixtures", () => {
  const now = new Date("2026-06-06T12:00:00Z");
  const result = pickWeeklySpotlightMatches(sampleMatches, {
    openingDate: "2026-06-11",
    endDate: "2026-07-19",
    now,
  });

  assert.equal(result.meta.weekNumber, 1);
  assert.equal(result.matches.length, 1);
  assert.equal(result.matches[0].home, "Mexico");
});

test("week 2 shows second week matches only", () => {
  const now = new Date("2026-06-06T12:00:00Z");
  const result = pickWeeklySpotlightMatches(sampleMatches, {
    openingDate: "2026-06-11",
    endDate: "2026-07-19",
    weekIndex: 1,
    now,
  });

  assert.equal(result.meta.weekNumber, 2);
  assert.equal(result.matches.length, 1);
  assert.equal(result.matches[0].home, "United States");
});

test("buildFullScheduleGroups sorts by date", () => {
  const groups = buildFullScheduleGroups(sampleMatches);
  assert.equal(groups.length, 2);
  assert.ok(groups[0].dateKey < groups[1].dateKey);
});

test("getWeekWindow covers seven days", () => {
  const { weekStartKey, weekEndKey } = getWeekWindow("2026-06-11", 0);
  assert.equal(weekStartKey, "2026-06-11");
  assert.equal(weekEndKey, "2026-06-18");
});
