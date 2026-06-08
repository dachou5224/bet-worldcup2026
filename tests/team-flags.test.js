import test from "node:test";
import assert from "node:assert/strict";
import {
  getTeamFlagCode,
  getTeamFlagUrl,
  splitFixtureTeams,
} from "../lib/team-flags.js";

test("getTeamFlagCode resolves English and Chinese team names", () => {
  assert.equal(getTeamFlagCode("Mexico"), "mx");
  assert.equal(getTeamFlagCode("墨西哥"), "mx");
  assert.equal(getTeamFlagCode("England"), "gb-eng");
  assert.equal(getTeamFlagCode("英格兰"), "gb-eng");
  assert.equal(getTeamFlagCode("United States"), "us");
  assert.equal(getTeamFlagCode("South Korea"), "kr");
});

test("getTeamFlagCode returns null for placeholders", () => {
  assert.equal(getTeamFlagCode("Home TBD"), null);
  assert.equal(getTeamFlagCode("主队待定"), null);
});

test("getTeamFlagUrl builds flagcdn URLs", () => {
  assert.equal(getTeamFlagUrl("日本", { width: 40 }), "https://flagcdn.com/w40/jp.png");
  assert.equal(getTeamFlagUrl("Scotland", { width: 80 }), "https://flagcdn.com/w80/gb-sct.png");
  assert.equal(getTeamFlagUrl("Unknown FC"), null);
});

test("splitFixtureTeams parses vs labels", () => {
  assert.deepEqual(splitFixtureTeams("墨西哥 vs 南非"), {
    home: "墨西哥",
    away: "南非",
  });
});
