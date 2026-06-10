import assert from "node:assert/strict";
import test from "node:test";
import {
  buildGoldmanFixtureJoinEnvelope,
  compareDirectionalAlignment,
  gsResultTypeToOutcome,
  inferMarketLean,
  joinGoldmanGroupStageMatch,
} from "../lib/goldman-sachs-fixture-join.js";
import {
  buildMatchPairKey,
  normalizeCanonicalEnglishTeamName,
} from "../lib/goldman-sachs-team-aliases.js";

test("normalizeCanonicalEnglishTeamName resolves GS and football-data variants", () => {
  assert.equal(normalizeCanonicalEnglishTeamName("USA"), "United States");
  assert.equal(normalizeCanonicalEnglishTeamName("Bosnia and H."), "Bosnia-Herzegovina");
  assert.equal(normalizeCanonicalEnglishTeamName("Curacao"), "Curaçao");
  assert.equal(buildMatchPairKey("Mexico", "South Africa"), "Mexico__South Africa");
});

test("joinGoldmanGroupStageMatch attaches fixtureId and directional alignment", () => {
  const gsMatch = {
    group: "A",
    matchDay: 1,
    date: "11-Jun",
    homeTeam: "Mexico",
    awayTeam: "South Africa",
    scoreline: "2-0",
    resultType: "home_win",
  };

  const indexes = {
    footballData: {
      byGroupDayPair: new Map([
        [
          "A:1:Mexico__South Africa",
          {
            footballDataMatchId: 537327,
            group: "A",
            matchDay: 1,
            homeTeam: "Mexico",
            awayTeam: "South Africa",
            utcDate: "2026-06-11T19:00:00Z",
            pairKey: "Mexico__South Africa",
          },
        ],
      ]),
      byPair: new Map(),
    },
    oddsApi: {
      byPair: new Map([
        [
          "Mexico__South Africa",
          {
            fixtureId: 8287,
            pairKey: "Mexico__South Africa",
            homeTeam: "Mexico",
            awayTeam: "South Africa",
            commenceTime: "2026-06-11T19:00:00Z",
            marketH2h: { home: 0.66, draw: 0.22, away: 0.12, bookmakerCount: 10 },
            marketLean: "home",
          },
        ],
      ]),
    },
    jingcai: {
      byFixtureId: new Map([
        [
          8287,
          {
            fixtureId: 8287,
            jingcaiMatchId: "JC-2026-8287",
            homeTeamZh: "墨西哥",
            awayTeamZh: "南非",
          },
        ],
      ]),
    },
  };

  const joined = joinGoldmanGroupStageMatch(gsMatch, indexes);
  assert.equal(joined.fixtureId, 8287);
  assert.equal(joined.footballDataMatchId, 537327);
  assert.equal(joined.jingcaiMatchId, "JC-2026-8287");
  assert.equal(joined.directionalAlignment, "aligned");
});

test("compareDirectionalAlignment flags draw divergence in Group D style matches", () => {
  assert.equal(gsResultTypeToOutcome("draw"), "draw");
  assert.equal(inferMarketLean({ home: 0.34, draw: 0.33, away: 0.33 }), "home");
  assert.equal(compareDirectionalAlignment("draw", "home"), "divergent");
});

test("buildGoldmanFixtureJoinEnvelope summarizes coverage", () => {
  const envelope = buildGoldmanFixtureJoinEnvelope({
    gsGroupStage: {
      matches: [
        {
          group: "D",
          matchDay: 1,
          date: "12-Jun",
          homeTeam: "USA",
          awayTeam: "Paraguay",
          scoreline: "1-1",
          resultType: "draw",
        },
      ],
    },
    footballDataMatches: [
      {
        id: 1,
        stage: "GROUP_STAGE",
        group: "GROUP_D",
        matchday: 1,
        utcDate: "2026-06-12T00:00:00Z",
        homeTeam: { name: "United States" },
        awayTeam: { name: "Paraguay" },
      },
    ],
    oddsEvents: [
      {
        id: "8290",
        home_team: "USA",
        away_team: "Paraguay",
        commence_time: "2026-06-13T01:00:00Z",
        bookmakers: [
          {
            key: "demo",
            markets: [
              {
                key: "h2h",
                outcomes: [
                  { name: "USA", price: 2.1 },
                  { name: "Draw", price: 3.2 },
                  { name: "Paraguay", price: 3.5 },
                ],
              },
            ],
          },
        ],
      },
    ],
    jingcaiMatches: [
      {
        fixtureId: 8290,
        jingcaiMatchId: "JC-2026-8290",
        homeTeam: "美国",
        awayTeam: "巴拉圭",
      },
    ],
  });

  assert.equal(envelope.summary.totalGsMatches, 1);
  assert.equal(envelope.summary.footballDataMatched, 1);
  assert.equal(envelope.summary.oddsApiMatched, 1);
  assert.equal(envelope.summary.jingcaiMatched, 1);
});
