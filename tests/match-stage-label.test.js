import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  formatBracketMatchup,
  formatBracketMatchupShort,
  formatBracketSlot,
  isPlaceholderTeam,
  resolveMatchStageInfo,
} from "../lib/match-stage-label.js";
import { WC2026_KNOCKOUT_BRACKET } from "../fixtures/wc2026-knockout-bracket.js";

describe("match-stage-label", () => {
  it("解析小组字母与轮次", () => {
    const info = resolveMatchStageInfo({
      stageCode: "GROUP_STAGE",
      groupCode: "GROUP_A",
      matchday: 2,
      home: "墨西哥",
      away: "南非",
      stage: "小组赛",
    });
    assert.equal(info.groupLetter, "A");
    assert.equal(info.stageDetail, "A组 · 第2轮");
    assert.equal(info.useSlotFixture, false);
  });

  it("格式化小组排名槽位", () => {
    const slot = formatBracketSlot("A1");
    assert.equal(slot.short, "A1");
    assert.equal(slot.long, "A组第1");

    const slot2 = formatBracketSlot("B2");
    assert.equal(slot2.short, "B2");
    assert.equal(slot2.long, "B组第2");
  });

  it("格式化淘汰赛对阵文案", () => {
    assert.equal(
      formatBracketMatchupShort("A1", "B2"),
      "A1 vs B2",
    );
    assert.equal(
      formatBracketMatchup("A1", "B2"),
      "A1（A组第1） vs B2（B组第2）",
    );
  });

  it("按 football-data 场次 ID 解析三十二强槽位", () => {
    const bracket = WC2026_KNOCKOUT_BRACKET[537417];
    assert.equal(bracket.home, "A2");
    assert.equal(bracket.away, "B2");

    const info = resolveMatchStageInfo({
      externalMatchId: 537417,
      stageCode: "LAST_32",
      home: "Home TBD",
      away: "Away TBD",
      stage: "三十二强",
    });
    assert.equal(info.bracketLineShort, "A2 vs B2");
    assert.equal(info.useSlotFixture, true);
  });

  it("识别待定队名", () => {
    assert.equal(isPlaceholderTeam("Home TBD"), true);
    assert.equal(isPlaceholderTeam("主队待定"), true);
    assert.equal(isPlaceholderTeam("墨西哥"), false);
  });

  it("按场次 ID 回填小组信息", () => {
    const info = resolveMatchStageInfo({
      id: 537327,
      externalMatchId: 537327,
      stage: "小组赛",
      home: "墨西哥",
      away: "南非",
    });
    assert.equal(info.groupLetter, "A");
    assert.equal(info.matchday, 1);
    assert.equal(info.isGroupStage, true);
  });
});
