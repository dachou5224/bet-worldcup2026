/**
 * 从 Goldman Sachs 报告 PDF 文本中解析 Exhibit 7 晋级概率表，
 * 并对齐 fixtures/fundamental-priors 下的 prior 字段约定。
 */

export const REPORT_META = {
  source: "Goldman Sachs Global Investment Research",
  reportTitle: "World Cup 2026: Predictions, Probabilities, and Paths to Victory",
  reportDate: "2026-05-29",
  pdfRelativePath: "docs/source-reports/goldman_sachs_worldcup2026_report.pdf",
  monteCarloRuns: 50000,
  probabilitiesAsOf: "2026-05-29",
};

/** PDF Exhibit 7 列名 → 本项目 stage 字段 */
export const STAGE_COLUMNS = [
  { pdfColumn: "R32", stage: "round_of_32", marketType: "tournament_advancement" },
  { pdfColumn: "R16", stage: "round_of_16", marketType: "tournament_advancement" },
  { pdfColumn: "QF", stage: "quarter_final", marketType: "tournament_advancement" },
  { pdfColumn: "SF", stage: "semi_final", marketType: "tournament_advancement" },
  { pdfColumn: "Final", stage: "final", marketType: "tournament_advancement" },
  { pdfColumn: "Winner", stage: "winner", marketType: "outright" },
];

const EXHIBIT7_MARKER = "Exhibit 7: Probabilities of Advancement";
const EXHIBIT7_END_MARKERS = [
  "Model-Implied Probabilities of Advancing",
  "Exhibit 8:",
];

/**
 * @param {string} pdfText
 * @returns {Array<{ team: string, probabilities: Record<string, number> }>}
 */
export function parseExhibit7AdvancementTable(pdfText) {
  const start = pdfText.indexOf(EXHIBIT7_MARKER);
  if (start < 0) {
    throw new Error(`未在 PDF 文本中找到 ${EXHIBIT7_MARKER}`);
  }

  let block = pdfText.slice(start);
  for (const marker of EXHIBIT7_END_MARKERS) {
    const end = block.indexOf(marker);
    if (end > 0) {
      block = block.slice(0, end);
    }
  }

  const lines = block
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const dataLines = lines.filter((line) => {
    const nums = line.match(/\d+\.\d+/g) || [];
    return nums.length >= 12;
  });

  if (dataLines.length === 0) {
    throw new Error("Exhibit 7 数据行解析失败：未找到含 12 个概率值的行");
  }

  /** @type {Array<{ team: string, probabilities: Record<string, number> }>} */
  const rows = [];

  for (const line of dataLines) {
    const nums = line.match(/\d+\.\d+/g) || [];
    if (nums.length % 6 !== 0) {
      throw new Error(`Exhibit 7 行概率个数异常: ${line}`);
    }

    const teamChunks = line
      .replace(/\d+\.\d+/g, "\0")
      .split("\0")
      .map((chunk) => chunk.trim())
      .filter(Boolean);

    const pairCount = nums.length / 6;
    if (teamChunks.length !== pairCount) {
      throw new Error(`Exhibit 7 队名与概率块数量不匹配: ${line}`);
    }

    for (let i = 0; i < pairCount; i += 1) {
      const offset = i * 6;
      const probabilities = {};
      for (let j = 0; j < STAGE_COLUMNS.length; j += 1) {
        const pct = Number(nums[offset + j]);
        probabilities[STAGE_COLUMNS[j].stage] = roundProbability(pct / 100);
      }
      rows.push({
        team: teamChunks[i],
        probabilities,
      });
    }
  }

  return rows;
}

/**
 * @param {Array<{ team: string, probabilities: Record<string, number> }>} teams
 */
export function buildPredictionsEnvelope(teams, options = {}) {
  const extractedAt = options.extractedAt || new Date().toISOString();
  const extractionMethod = options.extractionMethod || "pdf_text_exhibit_7";

  const winnerSum = teams.reduce(
    (sum, row) => sum + (row.probabilities.winner || 0),
    0,
  );

  return {
    ...REPORT_META,
    extractedAt,
    extractionMethod,
    sourceStatus: "publicly circulated PDF copy; structured extraction from Exhibit 7",
    usageInProject: "external fundamental probability prior (full tournament stage table)",
    validation: {
      teamCount: teams.length,
      expectedTeamCount: 48,
      winnerProbabilitySum: Number(winnerSum.toFixed(4)),
      stages: STAGE_COLUMNS.map(({ stage, pdfColumn, marketType }) => ({
        stage,
        pdfColumn,
        marketType,
      })),
    },
    narrativeSummary: {
      topWinnerProbabilities: teams
        .slice()
        .sort((a, b) => b.probabilities.winner - a.probabilities.winner)
        .slice(0, 6)
        .map(({ team, probabilities }) => ({
          team,
          probability: roundProbability(probabilities.winner),
        })),
      modalForecast: {
        predictedWinner: "Spain",
        predictedFinalists: ["Spain", "Argentina"],
        predictedSemiFinals: [
          ["France", "Spain"],
          ["Brazil", "Argentina"],
        ],
        notes: [
          "Spain projected to win second World Cup on 2026-07-19 in New York.",
          "Germany eliminated by France in round of 16 in modal path.",
          "England vs Brazil and Argentina vs Portugal projected quarter-finals.",
        ],
      },
      marketComparisonNotes: [
        "Model overweight Spain and Argentina vs market.",
        "Model underweight England and Portugal vs market.",
      ],
      historicalBenchmark2022: [
        { team: "Brazil", probability: 0.24 },
        { team: "Argentina", probability: 0.21 },
        { team: "France", probability: 0.19 },
      ],
    },
    teams: teams.map(({ team, probabilities }) => ({
      team,
      probabilities: Object.fromEntries(
        Object.entries(probabilities).map(([stage, value]) => [stage, roundProbability(value)]),
      ),
    })),
  };
}

/**
 * 扁平化为与 goldman_sachs_worldcup2026_prior.csv 相同列名的 long-form 行。
 * @param {ReturnType<typeof buildPredictionsEnvelope>} envelope
 */
export function flattenPredictionsToCsvRows(envelope) {
  const rows = [];
  for (const { team, probabilities } of envelope.teams) {
    for (const { stage, marketType } of STAGE_COLUMNS) {
      rows.push({
        source: envelope.source,
        report_title: envelope.reportTitle,
        report_date: envelope.reportDate,
        team,
        market_type: marketType,
        stage,
        probability: roundProbability(probabilities[stage]),
        extraction_method: envelope.extractionMethod,
        notes: `Exhibit 7 pdf column ${STAGE_COLUMNS.find((c) => c.stage === stage)?.pdfColumn}; as of ${envelope.probabilitiesAsOf}`,
      });
    }
  }
  return rows;
}

export function csvEscape(value) {
  const text = String(value ?? "");
  if (/[",\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function roundProbability(value) {
  return Number(Number(value).toFixed(4));
}

export function predictionsToCsv(envelope) {
  const header = [
    "source",
    "report_title",
    "report_date",
    "team",
    "market_type",
    "stage",
    "probability",
    "extraction_method",
    "notes",
  ];
  const rows = flattenPredictionsToCsvRows(envelope);
  const lines = [header.join(",")];
  for (const row of rows) {
    lines.push(header.map((key) => csvEscape(row[key])).join(","));
  }
  return `${lines.join("\n")}\n`;
}
