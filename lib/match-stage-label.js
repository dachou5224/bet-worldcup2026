import {
  THIRD_PLACE_SLOT_HINTS,
  WC2026_KNOCKOUT_BRACKET,
} from "../fixtures/wc2026-knockout-bracket.js";
import { WC2026_GROUP_BY_MATCH_ID } from "../fixtures/wc2026-group-stage-index.js";

const PLACEHOLDER_TEAMS = new Set([
  "",
  "Home TBD",
  "Away TBD",
  "主队待定",
  "客队待定",
  "TBD",
]);

const STAGE_SHORT = {
  GROUP_STAGE: "小组赛",
  LAST_32: "三十二强",
  LAST_16: "十六强",
  QUARTER_FINALS: "八强",
  SEMI_FINALS: "半决赛",
  THIRD_PLACE: "三四名",
  FINAL: "决赛",
};

function parseGroupLetter(value) {
  if (!value) {
    return null;
  }
  const text = String(value).trim();
  const fromCode = text.match(/^GROUP_([A-L])$/i);
  if (fromCode) {
    return fromCode[1].toUpperCase();
  }
  const fromLabel = text.match(/^Group\s+([A-L])$/i);
  if (fromLabel) {
    return fromLabel[1].toUpperCase();
  }
  const chinese = text.match(/^([A-L])组$/i);
  if (chinese) {
    return chinese[1].toUpperCase();
  }
  return null;
}

function parseGroupFromStageText(stage) {
  const text = String(stage || "");
  const letter = text.match(/([A-L])组/i);
  return letter ? letter[1].toUpperCase() : null;
}

function inferStageCode(match) {
  if (match.stageCode) {
    return match.stageCode;
  }
  const text = String(match.stage || "");
  if (text === "小组赛" || /小组/.test(text)) {
    return "GROUP_STAGE";
  }
  if (/三十二强|1\/32|last.?32/i.test(text)) {
    return "LAST_32";
  }
  if (/十六强|1\/16|last.?16/i.test(text)) {
    return "LAST_16";
  }
  if (/八强|四分之一|quarter/i.test(text)) {
    return "QUARTER_FINALS";
  }
  if (/半决赛|semi/i.test(text)) {
    return "SEMI_FINALS";
  }
  if (/三四名|third/i.test(text)) {
    return "THIRD_PLACE";
  }
  if (/决赛/.test(text) && !/四分之一|半/.test(text)) {
    return "FINAL";
  }
  return null;
}

function lookupGroupStageMeta(match) {
  const matchId = match.externalMatchId ?? match.id;
  if (matchId == null) {
    return null;
  }
  return WC2026_GROUP_BY_MATCH_ID[matchId] || WC2026_GROUP_BY_MATCH_ID[String(matchId)] || null;
}

function parseMatchday(value, stageText) {
  if (Number.isFinite(value) && value > 0) {
    return Number(value);
  }
  const fromStage = String(stageText || "").match(/第(\d+)轮/);
  return fromStage ? Number(fromStage[1]) : null;
}

export function isPlaceholderTeam(name) {
  return PLACEHOLDER_TEAMS.has(String(name || "").trim());
}

export function formatBracketSlot(slot) {
  const code = String(slot || "").trim().toUpperCase();
  if (!code) {
    return { code: "", short: "", long: "" };
  }

  if (/^W\d+$/.test(code)) {
    const matchNo = code.slice(1);
    return {
      code,
      short: code,
      long: `第${matchNo}场胜者`,
    };
  }

  if (/^L\d+$/.test(code)) {
    const matchNo = code.slice(1);
    return {
      code,
      short: code,
      long: `第${matchNo}场负者`,
    };
  }

  if (THIRD_PLACE_SLOT_HINTS[code]) {
    return {
      code,
      short: "3rd",
      long: THIRD_PLACE_SLOT_HINTS[code],
    };
  }

  const ranked = code.match(/^([A-L])([123])$/);
  if (ranked) {
    const [, group, rank] = ranked;
    const rankLabel = rank === "1" ? "第一" : rank === "2" ? "第二" : "第三";
    return {
      code,
      short: code,
      long: `${group}组第${rank}`,
    };
  }

  return { code, short: code, long: code };
}

export function formatBracketMatchup(homeSlot, awaySlot) {
  const home = formatBracketSlot(homeSlot);
  const away = formatBracketSlot(awaySlot);
  if (!home.code || !away.code) {
    return "";
  }
  return `${home.short}（${home.long}） vs ${away.short}（${away.long}）`;
}

export function formatBracketMatchupShort(homeSlot, awaySlot) {
  const home = formatBracketSlot(homeSlot);
  const away = formatBracketSlot(awaySlot);
  if (!home.code || !away.code) {
    return "";
  }
  return `${home.short} vs ${away.short}`;
}

export function resolveMatchStageInfo(match = {}) {
  const stageCode = inferStageCode(match);
  const groupLookup = stageCode === "GROUP_STAGE" ? lookupGroupStageMeta(match) : null;
  const groupLetter =
    parseGroupLetter(match.groupCode) ||
    parseGroupLetter(match.group) ||
    parseGroupLetter(match.groupLetter) ||
    parseGroupFromStageText(match.stage) ||
    groupLookup?.groupLetter ||
    null;
  const matchday =
    parseMatchday(match.matchday, match.stage) ?? groupLookup?.matchday ?? null;

  const bracket =
    match.externalMatchId != null
      ? WC2026_KNOCKOUT_BRACKET[match.externalMatchId] ||
        WC2026_KNOCKOUT_BRACKET[String(match.externalMatchId)]
      : null;

  const homeSlot = match.homeSlot || bracket?.home || null;
  const awaySlot = match.awaySlot || bracket?.away || null;
  const knockout = Boolean(stageCode && stageCode !== "GROUP_STAGE") || Boolean(bracket);

  let stageLabel = STAGE_SHORT[stageCode] || match.stage || "世界杯";
  if (stageCode === "GROUP_STAGE" && groupLetter) {
    stageLabel = `${groupLetter}组`;
  }

  const parts = [];
  if (stageCode === "GROUP_STAGE") {
    if (groupLetter) {
      parts.push(`${groupLetter}组`);
    } else {
      parts.push("小组赛");
    }
    if (matchday) {
      parts.push(`第${matchday}轮`);
    }
  } else if (knockout && homeSlot && awaySlot) {
    parts.push(stageLabel);
    parts.push(formatBracketMatchupShort(homeSlot, awaySlot));
  } else {
    parts.push(stageLabel);
  }

  const useSlotFixture =
    knockout &&
    homeSlot &&
    awaySlot &&
    (isPlaceholderTeam(match.home) || isPlaceholderTeam(match.away));

  return {
    stageCode,
    groupLetter,
    matchday,
    isGroupStage: stageCode === "GROUP_STAGE",
    matchNo: bracket?.matchNo || match.matchNo || null,
    homeSlot,
    awaySlot,
    stageLabel,
    stageDetail: parts.join(" · "),
    bracketLine: homeSlot && awaySlot ? formatBracketMatchup(homeSlot, awaySlot) : "",
    bracketLineShort: homeSlot && awaySlot ? formatBracketMatchupShort(homeSlot, awaySlot) : "",
    useSlotFixture,
  };
}

export function enrichUnifiedMatchStage(match) {
  const stageInfo = resolveMatchStageInfo(match);
  return { ...match, stageInfo };
}
