const OPENING_DAY_FALLBACK_NOTE =
  "FIFA 官方赛程快照；如果实时比分源可用，会自动切换为当天真实赛况。";

function formatOpeningDateLabel(openingDate) {
  const [, month, day] = String(openingDate || "").split("-");
  if (!month || !day) {
    return openingDate || "开幕日";
  }
  return `${Number(month)} 月 ${Number(day)} 日`;
}

export function isOpeningDayMatch(value, openingDate) {
  if (!value || typeof value !== "string") {
    return false;
  }

  return value.slice(0, 10) === openingDate;
}

export function formatOpeningDayNote(existingNote = "", openingDate = "2026-06-11") {
  if (!existingNote) {
    return OPENING_DAY_FALLBACK_NOTE;
  }

  if (existingNote.includes("FIFA 官方赛程快照")) {
    return existingNote;
  }

  return `${existingNote} 仅保留 ${formatOpeningDateLabel(openingDate)} 的开幕日场次。`;
}
