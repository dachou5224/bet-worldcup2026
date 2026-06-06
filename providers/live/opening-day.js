const OPENING_DAY_FALLBACK_NOTE =
  "FIFA 官方赛程快照；如果实时比分源可用，会自动切换为当天真实赛况。";

export function isOpeningDayMatch(value, openingDate) {
  if (!value || typeof value !== "string") {
    return false;
  }

  return value.slice(0, 10) === openingDate;
}

export function formatOpeningDayNote(existingNote = "") {
  if (!existingNote) {
    return OPENING_DAY_FALLBACK_NOTE;
  }

  if (existingNote.includes("FIFA 官方赛程快照")) {
    return existingNote;
  }

  return `${existingNote} 仅保留 6 月 11 日的开幕日场次。`;
}

