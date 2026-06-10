/**
 * Exhibit 5 / Exhibit 12：小组赛 modal 预测。
 * PDF 中为内嵌图片，无文本层；数据来自 pdf 第 6 / 13 页图片转录。
 */
import { REPORT_META, csvEscape } from "./goldman-sachs-pdf-extract.js";

export const GROUP_STAGE_LEGEND = {
  greenBackground: "modal_forecast_high_confidence",
  yellowBackground: "modal_forecast_standard",
  note: "PDF 图例区分背景色；报告发布日 2026-05-29 时均为 model modal 预测，非已踢完赛果。",
};

/** @type {Array<[string, number, string, string, string, number, number]>} */
export const EXHIBIT5_GROUP_MATCHES_RAW = [
  ["A", 1, "11-Jun", "Mexico", "South Africa", 2, 0],
  ["A", 1, "11-Jun", "South Korea", "Czechia", 1, 1],
  ["A", 2, "18-Jun", "Czechia", "South Africa", 1, 1],
  ["A", 2, "18-Jun", "Mexico", "South Korea", 2, 1],
  ["A", 3, "24-Jun", "Czechia", "Mexico", 1, 2],
  ["A", 3, "24-Jun", "South Africa", "South Korea", 1, 1],
  ["B", 1, "12-Jun", "Canada", "Bosnia and H.", 2, 1],
  ["B", 1, "13-Jun", "Qatar", "Switzerland", 0, 2],
  ["B", 2, "18-Jun", "Switzerland", "Bosnia and H.", 1, 1],
  ["B", 2, "18-Jun", "Canada", "Qatar", 2, 1],
  ["B", 3, "24-Jun", "Switzerland", "Canada", 1, 1],
  ["B", 3, "24-Jun", "Bosnia and H.", "Qatar", 1, 1],
  ["C", 1, "13-Jun", "Brazil", "Morocco", 2, 1],
  ["C", 1, "13-Jun", "Haiti", "Scotland", 1, 1],
  ["C", 2, "19-Jun", "Scotland", "Morocco", 1, 1],
  ["C", 2, "19-Jun", "Brazil", "Haiti", 2, 1],
  ["C", 3, "24-Jun", "Scotland", "Brazil", 1, 2],
  ["C", 3, "24-Jun", "Morocco", "Haiti", 1, 1],
  ["D", 1, "12-Jun", "USA", "Paraguay", 1, 1],
  ["D", 1, "13-Jun", "Australia", "Turkiye", 1, 1],
  ["D", 2, "19-Jun", "USA", "Australia", 1, 1],
  ["D", 2, "19-Jun", "Turkiye", "Paraguay", 1, 1],
  ["D", 3, "25-Jun", "Turkiye", "USA", 1, 1],
  ["D", 3, "25-Jun", "Paraguay", "Australia", 1, 1],
  ["E", 1, "14-Jun", "Germany", "Curacao", 2, 1],
  ["E", 1, "14-Jun", "Ivory Coast", "Ecuador", 1, 1],
  ["E", 2, "20-Jun", "Germany", "Ivory Coast", 2, 1],
  ["E", 2, "20-Jun", "Ecuador", "Curacao", 2, 1],
  ["E", 3, "25-Jun", "Curacao", "Ivory Coast", 1, 1],
  ["E", 3, "25-Jun", "Ecuador", "Germany", 1, 2],
  ["F", 1, "14-Jun", "Netherlands", "Japan", 1, 1],
  ["F", 1, "14-Jun", "Sweden", "Tunisia", 1, 1],
  ["F", 2, "20-Jun", "Netherlands", "Sweden", 2, 1],
  ["F", 2, "20-Jun", "Tunisia", "Japan", 1, 1],
  ["F", 3, "25-Jun", "Japan", "Sweden", 1, 1],
  ["F", 3, "25-Jun", "Tunisia", "Netherlands", 1, 2],
  ["G", 1, "15-Jun", "Belgium", "Egypt", 1, 1],
  ["G", 1, "15-Jun", "Iran", "New Zealand", 1, 1],
  ["G", 2, "21-Jun", "Belgium", "Iran", 1, 1],
  ["G", 2, "21-Jun", "New Zealand", "Egypt", 1, 1],
  ["G", 3, "26-Jun", "Egypt", "Iran", 1, 1],
  ["G", 3, "26-Jun", "New Zealand", "Belgium", 1, 1],
  ["H", 1, "15-Jun", "Spain", "Cape Verde", 3, 0],
  ["H", 1, "15-Jun", "Saudi Arabia", "Uruguay", 1, 1],
  ["H", 2, "21-Jun", "Spain", "Saudi Arabia", 3, 0],
  ["H", 2, "21-Jun", "Uruguay", "Cape Verde", 1, 1],
  ["H", 3, "26-Jun", "Uruguay", "Spain", 0, 2],
  ["H", 3, "26-Jun", "Cape Verde", "Saudi Arabia", 1, 1],
  ["I", 1, "16-Jun", "France", "Senegal", 2, 1],
  ["I", 1, "16-Jun", "Iraq", "Norway", 1, 2],
  ["I", 2, "22-Jun", "France", "Iraq", 3, 0],
  ["I", 2, "22-Jun", "Norway", "Senegal", 1, 1],
  ["I", 3, "26-Jun", "Norway", "France", 1, 2],
  ["I", 3, "26-Jun", "Senegal", "Iraq", 2, 1],
  ["J", 1, "16-Jun", "Argentina", "Algeria", 2, 1],
  ["J", 1, "16-Jun", "Austria", "Jordan", 1, 1],
  ["J", 2, "22-Jun", "Argentina", "Austria", 2, 1],
  ["J", 2, "22-Jun", "Jordan", "Algeria", 1, 1],
  ["J", 3, "27-Jun", "Algeria", "Austria", 1, 1],
  ["J", 3, "27-Jun", "Jordan", "Argentina", 1, 2],
  ["K", 1, "17-Jun", "Portugal", "DR Congo", 2, 1],
  ["K", 1, "17-Jun", "Uzbekistan", "Colombia", 1, 1],
  ["K", 2, "23-Jun", "Portugal", "Uzbekistan", 2, 1],
  ["K", 2, "23-Jun", "Colombia", "DR Congo", 2, 1],
  ["K", 3, "27-Jun", "Colombia", "Portugal", 1, 1],
  ["K", 3, "27-Jun", "DR Congo", "Uzbekistan", 1, 1],
  ["L", 1, "17-Jun", "England", "Croatia", 1, 1],
  ["L", 1, "17-Jun", "Ghana", "Panama", 1, 1],
  ["L", 2, "23-Jun", "England", "Ghana", 2, 1],
  ["L", 2, "23-Jun", "Panama", "Croatia", 1, 2],
  ["L", 3, "27-Jun", "Panama", "England", 1, 2],
  ["L", 3, "27-Jun", "Croatia", "Ghana", 2, 1],
];

/** @type {Array<[string, number, string, number, number, number, number, string]>} */
export const EXHIBIT12_GROUP_STANDINGS_RAW = [
  ["A", 1, "Mexico", 6, 2, 4, 9, "top_2"],
  ["A", 2, "South Korea", 3, 4, -1, 2, "top_2"],
  ["A", 3, "Czechia", 3, 4, -1, 2, "best_third"],
  ["A", 4, "South Africa", 2, 4, -2, 2, "out"],
  ["B", 1, "Canada", 5, 3, 2, 7, "top_2"],
  ["B", 2, "Switzerland", 4, 2, 2, 5, "top_2"],
  ["B", 3, "Bosnia and H.", 3, 4, -1, 2, "best_third"],
  ["B", 4, "Qatar", 2, 5, -3, 1, "out"],
  ["C", 1, "Brazil", 6, 3, 3, 9, "top_2"],
  ["C", 2, "Morocco", 3, 4, -1, 2, "top_2"],
  ["C", 3, "Scotland", 3, 4, -1, 2, "best_third"],
  ["C", 4, "Haiti", 3, 4, -1, 2, "out"],
  ["D", 1, "Turkiye", 3, 3, 0, 3, "top_2"],
  ["D", 2, "USA", 3, 3, 0, 3, "top_2"],
  ["D", 3, "Paraguay", 3, 3, 0, 3, "best_third"],
  ["D", 4, "Australia", 3, 3, 0, 3, "out"],
  ["E", 1, "Germany", 6, 3, 3, 9, "top_2"],
  ["E", 2, "Ecuador", 4, 4, 0, 4, "top_2"],
  ["E", 3, "Ivory Coast", 3, 4, -1, 2, "out"],
  ["E", 4, "Curacao", 3, 5, -2, 1, "out"],
  ["F", 1, "Netherlands", 5, 3, 2, 7, "top_2"],
  ["F", 2, "Japan", 3, 3, 0, 3, "top_2"],
  ["F", 3, "Sweden", 3, 4, -1, 2, "best_third"],
  ["F", 4, "Tunisia", 3, 4, -1, 2, "out"],
  ["G", 1, "Belgium", 3, 3, 0, 3, "top_2"],
  ["G", 2, "Iran", 3, 3, 0, 3, "top_2"],
  ["G", 3, "Egypt", 3, 3, 0, 3, "best_third"],
  ["G", 4, "New Zealand", 3, 3, 0, 3, "out"],
  ["H", 1, "Spain", 8, 0, 8, 9, "top_2"],
  ["H", 2, "Uruguay", 2, 4, -2, 2, "top_2"],
  ["H", 3, "Cape Verde", 2, 5, -3, 2, "out"],
  ["H", 4, "Saudi Arabia", 2, 5, -3, 2, "out"],
  ["I", 1, "France", 7, 2, 5, 9, "top_2"],
  ["I", 2, "Norway", 4, 4, 0, 4, "top_2"],
  ["I", 3, "Senegal", 4, 4, 0, 4, "best_third"],
  ["I", 4, "Iraq", 2, 7, -5, 0, "out"],
  ["J", 1, "Argentina", 6, 3, 3, 9, "top_2"],
  ["J", 2, "Austria", 3, 4, -1, 2, "top_2"],
  ["J", 3, "Algeria", 3, 4, -1, 2, "out"],
  ["J", 4, "Jordan", 3, 4, -1, 2, "out"],
  ["K", 1, "Portugal", 5, 3, 2, 7, "top_2"],
  ["K", 2, "Colombia", 4, 3, 1, 5, "top_2"],
  ["K", 3, "Uzbekistan", 3, 4, -1, 2, "best_third"],
  ["K", 4, "DR Congo", 3, 5, -2, 1, "out"],
  ["L", 1, "England", 5, 3, 2, 7, "top_2"],
  ["L", 2, "Croatia", 5, 3, 2, 7, "top_2"],
  ["L", 3, "Panama", 3, 5, -2, 1, "out"],
  ["L", 4, "Ghana", 3, 5, -2, 1, "out"],
];

export function normalizeGroupMatchRow([
  group,
  matchDay,
  date,
  homeTeam,
  awayTeam,
  homeGoals,
  awayGoals,
]) {
  return {
    group,
    matchDay,
    date,
    homeTeam,
    awayTeam,
    homeGoals,
    awayGoals,
    scoreline: `${homeGoals}-${awayGoals}`,
    stage: "group_stage",
    marketType: "match_result_modal",
    resultType:
      homeGoals > awayGoals ? "home_win" : awayGoals > homeGoals ? "away_win" : "draw",
  };
}

export function normalizeGroupStandingRow([
  group,
  position,
  team,
  goalsFor,
  goalsAgainst,
  goalDifference,
  points,
  qualification,
]) {
  return {
    group,
    position,
    team,
    goalsFor,
    goalsAgainst,
    goalDifference,
    points,
    qualification,
  };
}

export function buildGroupStageEnvelope(options = {}) {
  const extractedAt = options.extractedAt || new Date().toISOString();
  const extractionMethod = options.extractionMethod || "pdf_image_exhibit_5_12";

  const matches = EXHIBIT5_GROUP_MATCHES_RAW.map(normalizeGroupMatchRow);
  const standings = EXHIBIT12_GROUP_STANDINGS_RAW.map(normalizeGroupStandingRow);

  const groupCount = new Set(matches.map((m) => m.group)).size;
  const teamsInGroups = new Set(
    matches.flatMap((m) => [m.homeTeam, m.awayTeam]),
  );

  return {
    ...REPORT_META,
    extractedAt,
    extractionMethod,
    sourceStatus:
      "publicly circulated PDF copy; group tables are embedded images (Exhibit 5 / 12)",
    usageInProject: "external fundamental modal forecast for group-stage match results",
    pdfPages: {
      exhibit5GroupMatches: 6,
      exhibit12GroupStandings: 13,
    },
    legend: GROUP_STAGE_LEGEND,
    validation: {
      matchCount: matches.length,
      expectedMatchCount: 72,
      groupCount,
      expectedGroupCount: 12,
      teamCount: teamsInGroups.size,
      expectedTeamCount: 48,
      standingRowCount: standings.length,
      expectedStandingRowCount: 48,
    },
    matches,
    groupStandings: standings,
  };
}

export function flattenGroupMatchesToCsvRows(envelope) {
  return envelope.matches.map((match) => ({
    source: envelope.source,
    report_title: envelope.reportTitle,
    report_date: envelope.reportDate,
    exhibit: "Exhibit 5",
    group: match.group,
    match_day: match.matchDay,
    date: match.date,
    home_team: match.homeTeam,
    away_team: match.awayTeam,
    home_goals: match.homeGoals,
    away_goals: match.awayGoals,
    scoreline: match.scoreline,
    result_type: match.resultType,
    market_type: match.marketType,
    stage: match.stage,
    extraction_method: envelope.extractionMethod,
    notes: "Most Likely Predicted Group Stage Results; modal forecast as of report date",
  }));
}

export function groupStageMatchesToCsv(envelope) {
  const header = [
    "source",
    "report_title",
    "report_date",
    "exhibit",
    "group",
    "match_day",
    "date",
    "home_team",
    "away_team",
    "home_goals",
    "away_goals",
    "scoreline",
    "result_type",
    "market_type",
    "stage",
    "extraction_method",
    "notes",
  ];
  const rows = flattenGroupMatchesToCsvRows(envelope);
  const lines = [header.join(",")];
  for (const row of rows) {
    lines.push(header.map((key) => csvEscape(row[key])).join(","));
  }
  return `${lines.join("\n")}\n`;
}

export function verifyPdfGroupStageImages(pdfPath) {
  const python = `
import sys
import fitz
doc = fitz.open(sys.argv[1])
checks = []
for page_no, min_images in [(5, 1), (12, 1)]:
    page = doc[page_no]
    checks.append({"page": page_no + 1, "imageCount": len(page.get_images()), "ok": len(page.get_images()) >= min_images})
import json
print(json.dumps(checks))
`;
  return python;
}
