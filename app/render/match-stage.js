import { escapeHtml } from "../format.js";
import { formatBracketSlot } from "../../lib/match-stage-label.js";
import { renderFixtureWithFlags } from "./team-flag.js";

function getStageInfo(match) {
  return match.stageInfo || {};
}

export function renderStageBadge(match) {
  const info = getStageInfo(match);
  if (info.groupLetter) {
    return `<span class="stage-badge stage-badge-group">${escapeHtml(info.groupLetter)}组</span>`;
  }
  if (info.bracketLineShort) {
    return `<span class="stage-badge stage-badge-knockout">${escapeHtml(info.bracketLineShort)}</span>`;
  }
  if (info.stageLabel) {
    return `<span class="stage-badge">${escapeHtml(info.stageLabel)}</span>`;
  }
  return "";
}

export function renderSlotSide(slot) {
  const formatted = formatBracketSlot(slot);
  if (!formatted.code) {
    return "";
  }
  return `<span class="slot-side"><strong class="slot-code">${escapeHtml(formatted.short)}</strong><span class="slot-hint">${escapeHtml(formatted.long)}</span></span>`;
}

export function renderBracketFixture(homeSlot, awaySlot) {
  return `<span class="fixture-bracket-slots">${renderSlotSide(homeSlot)}<span class="fixture-vs">vs</span>${renderSlotSide(awaySlot)}</span>`;
}

export function renderMatchFixture(match, options = {}) {
  const info = getStageInfo(match);
  if (info.useSlotFixture && info.homeSlot && info.awaySlot) {
    return renderBracketFixture(info.homeSlot, info.awaySlot);
  }
  return renderFixtureWithFlags(match.home, match.away, options);
}

export function renderGroupStageChips(match) {
  const info = getStageInfo(match);
  if (!info.isGroupStage) {
    return "";
  }

  const chips = [];
  if (info.groupLetter) {
    chips.push(`<span class="stage-chip stage-chip-group">${escapeHtml(info.groupLetter)}组</span>`);
  }
  if (info.matchday) {
    chips.push(
      `<span class="stage-chip stage-chip-round">小组赛第${escapeHtml(String(info.matchday))}轮</span>`,
    );
  } else if (!info.groupLetter) {
    chips.push(`<span class="stage-chip stage-chip-round">小组赛</span>`);
  }

  if (!chips.length) {
    return "";
  }

  return `<div class="match-stage-chips">${chips.join("")}</div>`;
}

export function renderKnockoutStageChips(match) {
  const info = getStageInfo(match);
  if (info.isGroupStage || !info.bracketLineShort) {
    return "";
  }
  return `<div class="match-stage-chips"><span class="stage-chip stage-chip-knockout">${escapeHtml(info.stageLabel || "淘汰赛")}</span><span class="stage-chip stage-chip-bracket">${escapeHtml(info.bracketLineShort)}</span></div>`;
}

export function renderMatchStageChips(match) {
  const group = renderGroupStageChips(match);
  if (group) {
    return group;
  }
  return renderKnockoutStageChips(match);
}

export function renderMatchStatusLine(match) {
  const parts = [match.status || "待开赛"];
  if (match.venue && match.venue !== "场地待定") {
    parts.push(match.venue);
  }
  return parts.join(" · ");
}

export function renderMatchStageMeta(match) {
  const info = getStageInfo(match);
  if (info.stageDetail) {
    return info.stageDetail;
  }
  return match.stage || "世界杯";
}

export function renderMatchStageLine(match) {
  const info = getStageInfo(match);
  const parts = [renderMatchStageMeta(match), match.status || "待开赛"];
  if (info.bracketLine && !info.useSlotFixture) {
    parts.push(info.bracketLine);
  }
  return parts.filter(Boolean).join(" · ");
}
