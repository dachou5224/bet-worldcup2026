import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, test } from "node:test";
import {
  filterSportteryMatches,
  normalizeSportteryMatchToJingcaiRecord,
} from "../lib/sporttery-webapi-normalize.js";
import { flattenSportteryMatchList } from "../lib/sporttery-webapi.js";

describe("sporttery-webapi-normalize", () => {
  test("normalizeSportteryMatchToJingcaiRecord maps HAD/HHAD to spf/rqspf", () => {
    const record = normalizeSportteryMatchToJingcaiRecord(
      {
        matchId: 2040162,
        matchNumStr: "周四001",
        homeTeamAllName: "墨西哥",
        awayTeamAllName: "南非",
        leagueAllName: "世界杯",
        matchDate: "2026-06-12",
        matchTime: "03:00",
        matchStatus: "Selling",
        sellStatus: "1",
        oddsList: [
          { poolCode: "HAD", h: "1.31", d: "4.10", a: "8.30" },
          { poolCode: "HHAD", h: "2.13", d: "3.28", a: "2.82", goalLine: "-1.00" },
        ],
        poolList: [
          { poolCode: "HAD", poolStatus: "Selling" },
          { poolCode: "HHAD", poolStatus: "Selling" },
        ],
      },
      {
        capturedAt: "2026-06-09T07:00:00+08:00",
        baselineByKey: new Map([
          [
            "墨西哥__南非",
            {
              fixtureId: 8287,
              jingcaiMatchId: "JC-2026-8287",
              stopSaleTime: "2026-06-12T02:55:00+08:00",
            },
          ],
        ]),
      },
    );

    assert.equal(record.fixtureId, 8287);
    assert.equal(record.availablePlays.spf.odds["3"], 1.31);
    assert.equal(record.availablePlays.rqspf.handicap, -1);
    assert.equal(record.sportteryMeta.matchNumStr, "周四001");
  });

  test("filterSportteryMatches keeps world cup league", () => {
    const sample = flattenSportteryMatchList(
      JSON.parse(readFileSync("/tmp/sporttery-matches.json", "utf-8")),
    );
    const filtered = filterSportteryMatches(sample, { leagueName: "世界杯" });
    assert.ok(filtered.length >= 5);
    assert.ok(filtered.every((match) => (match.leagueAllName || "").includes("世界杯")));
  });
});
