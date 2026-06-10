/**
 * 用 Gemini + Google Search 生成竞彩官方盘草稿，并与 latest 快照 diff。
 * 输出：fixtures/drafts/jingcai-gemini-draft.json
 *
 * 用法：GEMINI_API_KEY=... GEMINI_HTTPS_PROXY=127.0.0.1:3213 npm run draft:jingcai-gemini
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { loadProjectEnv } from "../lib/load-env.js";
import { projectRoot } from "../lib/paths.js";
import {
  buildDraftFeedFromGeminiResponse,
  buildJingcaiGeminiPrompt,
  diffDraftAgainstBaseline,
  filterOfficialGeminiMatches,
} from "../lib/jingcai-gemini-draft.js";
import {
  callGeminiGenerateContent,
  getGeminiConfig,
  tryParseJsonFromModelText,
} from "../lib/gemini-client.js";
import { validateJingcaiOfficialFeed } from "../schemas/jingcai-official-feed.js";

loadProjectEnv();

const BASELINE_FILE =
  process.env.JINGCAI_BASELINE_FILE ||
  path.join(projectRoot, "fixtures/snapshots/latest/jingcai-official-feed.json");
const DRAFT_FILE =
  process.env.JINGCAI_GEMINI_DRAFT_FILE ||
  path.join(projectRoot, "fixtures/drafts/jingcai-gemini-draft.json");
const DIFF_FILE =
  process.env.JINGCAI_GEMINI_DIFF_FILE ||
  path.join(projectRoot, "fixtures/drafts/jingcai-gemini-diff.json");

function readJson(filePath) {
  return JSON.parse(readFileSync(filePath, "utf-8"));
}

function writeJson(filePath, payload) {
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`, "utf-8");
}

async function run() {
  const config = getGeminiConfig();
  if (!config.apiKey) {
    console.error(
      JSON.stringify(
        {
          ok: false,
          error: "缺少 GEMINI_API_KEY，请写入 .env（勿提交到 .env.example）",
        },
        null,
        2,
      ),
    );
    process.exitCode = 1;
    return;
  }

  const baselineEnvelope = readJson(BASELINE_FILE);
  const officialOnly = config.jingcaiSourceMode !== "open_search";
  const prompt = buildJingcaiGeminiPrompt(baselineEnvelope, {
    officialOnly,
    officialUrls: config.jingcaiOfficialUrls,
    officialDomains: config.jingcaiOfficialDomains,
  });
  const startedAt = Date.now();

  const gemini = await callGeminiGenerateContent({
    prompt,
    useGoogleSearch: true,
    useUrlContext: officialOnly,
    timeoutMs: Number(process.env.GEMINI_TIMEOUT_MS || 120000),
  });

  const parsedRaw = tryParseJsonFromModelText(gemini.text);
  if (!parsedRaw) {
    console.error(
      JSON.stringify(
        {
          ok: false,
          error: "Gemini 返回无法解析为 JSON",
          model: gemini.model,
          proxy: gemini.proxy,
          rawTextPreview: gemini.text.slice(0, 600),
        },
        null,
        2,
      ),
    );
    process.exitCode = 1;
    return;
  }

  const parsed = officialOnly
    ? filterOfficialGeminiMatches(parsedRaw, config.jingcaiOfficialDomains)
    : parsedRaw;

  const draftEnvelope = buildDraftFeedFromGeminiResponse(parsed, baselineEnvelope, {
    capturedAt: new Date().toISOString(),
    model: gemini.model,
    proxy: gemini.proxy,
    grounding: gemini.grounding,
    sourceMode: config.jingcaiSourceMode,
    officialDomains: config.jingcaiOfficialDomains,
    rejectedSources: parsed.rejected || [],
  });

  const validation = validateJingcaiOfficialFeed(draftEnvelope.matches);
  const diff = diffDraftAgainstBaseline(draftEnvelope, baselineEnvelope);

  writeJson(DRAFT_FILE, draftEnvelope);
  writeJson(DIFF_FILE, diff);

  const summary = {
    ok: validation.ok,
    ms: Date.now() - startedAt,
    model: gemini.model,
    proxy: gemini.proxy,
    files: {
      draft: DRAFT_FILE,
      diff: DIFF_FILE,
      baseline: BASELINE_FILE,
    },
    draft: {
      matchCount: draftEnvelope.matches.length,
      rejectedSourceCount: (parsed.rejected || []).length,
      sourceMode: config.jingcaiSourceMode,
      officialOnly,
      manualReviewed: draftEnvelope.manualReviewed,
      directEVEligible: draftEnvelope.directEVEligible,
      sourceMode: draftEnvelope.sourceMode,
      geminiFound: draftEnvelope.gemini.found,
      note: draftEnvelope.gemini.note,
    },
    validation,
    diff: {
      changedCount: diff.changedCount,
      missingCount: diff.missingCount,
      newCount: diff.newCount,
      unchangedCount: diff.unchangedCount,
      items: diff.items,
    },
    nextSteps: [
      "对照 https://www.sporttery.cn/jc/zqszsc/ 人工复核 draft 中每场 spf/rqspf 与 stopSaleTime",
      "确认无误后设 manualReviewed=true，再复制到 fixtures/snapshots/latest/jingcai-official-feed.json",
      "未复核前勿在 APP_MODE=research 下替换 latest 快照",
    ],
  };

  console.log(JSON.stringify(summary, null, 2));
  if (!validation.ok) {
    process.exitCode = 1;
  }
}

run().catch((error) => {
  console.error(JSON.stringify({ ok: false, error: error.message }, null, 2));
  process.exitCode = 1;
});
