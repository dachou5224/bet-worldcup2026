/**
 * 从本地 Goldman Sachs PDF 提取：
 * - Exhibit 7 晋级概率（文本层）
 * - Exhibit 5 / 12 小组赛 modal 预测（图片层转录）
 *
 * npm run extract:goldman-sachs-pdf
 */
import { spawnSync } from "node:child_process";
import { existsSync, writeFileSync } from "node:fs";
import path from "node:path";
import {
  buildGroupStageEnvelope,
  groupStageMatchesToCsv,
  verifyPdfGroupStageImages,
} from "../lib/goldman-sachs-group-stage-extract.js";
import {
  REPORT_META,
  buildPredictionsEnvelope,
  parseExhibit7AdvancementTable,
  predictionsToCsv,
} from "../lib/goldman-sachs-pdf-extract.js";
import { projectRoot } from "../lib/paths.js";

const PDF_FILE =
  process.env.GOLDMAN_SACHS_PDF_FILE ||
  path.join(projectRoot, REPORT_META.pdfRelativePath);
const JSON_OUT =
  process.env.GOLDMAN_SACHS_PREDICTIONS_JSON ||
  path.join(projectRoot, "fixtures/fundamental-priors/goldman_sachs_worldcup2026_predictions.json");
const CSV_OUT =
  process.env.GOLDMAN_SACHS_PREDICTIONS_CSV ||
  path.join(projectRoot, "fixtures/fundamental-priors/goldman_sachs_worldcup2026_predictions.csv");
const GROUP_JSON_OUT =
  process.env.GOLDMAN_SACHS_GROUP_JSON ||
  path.join(projectRoot, "fixtures/fundamental-priors/goldman_sachs_worldcup2026_group_stage.json");
const GROUP_CSV_OUT =
  process.env.GOLDMAN_SACHS_GROUP_CSV ||
  path.join(
    projectRoot,
    "fixtures/fundamental-priors/goldman_sachs_worldcup2026_group_stage_matches.csv",
  );

function extractPdfText(pdfPath) {
  const python = `
import sys
try:
    from pypdf import PdfReader
except ImportError:
    sys.stderr.write("missing pypdf; run: pip3 install pypdf\\n")
    sys.exit(2)
reader = PdfReader(sys.argv[1])
print("".join((page.extract_text() or "") + "\\n" for page in reader.pages), end="")
`;
  const result = spawnSync("python3", ["-c", python, pdfPath], {
    encoding: "utf-8",
    maxBuffer: 20 * 1024 * 1024,
  });
  if (result.status === 2) {
    throw new Error(result.stderr.trim());
  }
  if (result.status !== 0) {
    throw new Error(result.stderr.trim() || `python exit ${result.status}`);
  }
  return result.stdout;
}

function assertGroupStageImages(pdfPath) {
  const result = spawnSync("python3", ["-c", verifyPdfGroupStageImages(pdfPath), pdfPath], {
    encoding: "utf-8",
  });
  if (result.status !== 0) {
    throw new Error(
      result.stderr.trim() ||
        "无法校验 PDF 小组赛图片页；请安装 pymupdf: pip3 install pymupdf",
    );
  }
  const checks = JSON.parse(result.stdout);
  for (const check of checks) {
    if (!check.ok) {
      throw new Error(`PDF 第 ${check.page} 页缺少 Exhibit 小组赛图片`);
    }
  }
  return checks;
}

function main() {
  if (!existsSync(PDF_FILE)) {
    throw new Error(
      `PDF 不存在: ${PDF_FILE}\n请先下载到 docs/source-reports/（见 docs/source-reports/goldman_sachs_worldcup2026_report.md）`,
    );
  }

  const imageChecks = assertGroupStageImages(PDF_FILE);

  const pdfText = extractPdfText(PDF_FILE);
  const teams = parseExhibit7AdvancementTable(pdfText);
  const envelope = buildPredictionsEnvelope(teams, {
    extractionMethod: "pdf_text_exhibit_7",
  });

  if (envelope.validation.teamCount !== envelope.validation.expectedTeamCount) {
    throw new Error(
      `球队数量 ${envelope.validation.teamCount} != ${envelope.validation.expectedTeamCount}`,
    );
  }

  const groupStage = buildGroupStageEnvelope({
    extractionMethod: "pdf_image_exhibit_5_12",
  });
  if (groupStage.validation.matchCount !== groupStage.validation.expectedMatchCount) {
    throw new Error(
      `小组赛场次 ${groupStage.validation.matchCount} != ${groupStage.validation.expectedMatchCount}`,
    );
  }

  writeFileSync(JSON_OUT, `${JSON.stringify(envelope, null, 2)}\n`, "utf-8");
  writeFileSync(CSV_OUT, predictionsToCsv(envelope), "utf-8");
  writeFileSync(GROUP_JSON_OUT, `${JSON.stringify(groupStage, null, 2)}\n`, "utf-8");
  writeFileSync(GROUP_CSV_OUT, groupStageMatchesToCsv(groupStage), "utf-8");

  console.log(
    JSON.stringify(
      {
        ok: true,
        pdfFile: PDF_FILE,
        advancement: {
          jsonOut: JSON_OUT,
          csvOut: CSV_OUT,
          teamCount: envelope.validation.teamCount,
          winnerProbabilitySum: envelope.validation.winnerProbabilitySum,
          topWinners: envelope.narrativeSummary.topWinnerProbabilities,
        },
        groupStage: {
          jsonOut: GROUP_JSON_OUT,
          csvOut: GROUP_CSV_OUT,
          imageChecks,
          matchCount: groupStage.validation.matchCount,
          groupCount: groupStage.validation.groupCount,
          sampleMatches: groupStage.matches.slice(0, 3),
        },
      },
      null,
      2,
    ),
  );
}

main();
