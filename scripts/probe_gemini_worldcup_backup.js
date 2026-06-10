/**
 * 探测 Gemini + Google Search grounding 能否补齐项目真实数据缺口。
 * 用法：在 .env 或 .env.example 设置 GEMINI_API_KEY 后运行 npm run probe:gemini-backup
 */
import path from "node:path";
import { existsSync, readFileSync } from "node:fs";
import { loadLocalEnv } from "../lib/load-env.js";
import { projectRoot } from "../lib/paths.js";
import {
  describeProxyUsage,
  fetchTextViaHttpsProxy,
  resolveHttpsProxyUrl,
} from "../lib/https-proxy-fetch.js";

loadLocalEnv();
loadEnvExampleFallback();

function loadEnvExampleFallback() {
  const examplePath = path.join(projectRoot, ".env.example");
  if (!existsSync(examplePath)) {
    return;
  }

  for (const line of readFileSync(examplePath, "utf-8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) {
      continue;
    }
    const key = trimmed.slice(0, trimmed.indexOf("=")).trim();
    const value = trimmed.slice(trimmed.indexOf("=") + 1).trim();
    if (!(key in process.env) && value) {
      process.env[key] = value;
    }
  }
}

const API_KEY = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || "";
const MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";
const BASE_URL = "https://generativelanguage.googleapis.com/v1beta";

const PROBES = [
  {
    id: "live_fixtures",
    role: "B-1 赛程/比分补充",
    researchEligible: "maybe",
    directEV: false,
    prompt: `今天是 2026-06-09。请用 Google 搜索查找 2026 FIFA World Cup 官方赛程信息。
列出接下来 3 场小组赛（UTC 开球时间、主队、客队、比赛 id 若可查）。
仅输出 JSON 数组，每项字段：homeTeam, awayTeam, utcDate, status, sourceUrl。
不要编造；查不到就返回空数组并在 note 说明。`,
  },
  {
    id: "h2h_odds",
    role: "B-2 海外 h2h 赔率 backup",
    researchEligible: "unlikely",
    directEV: true,
    prompt: `请搜索 2026 FIFA World Cup 小组赛「墨西哥 vs 南非」当前主流博彩公司的 90 分钟胜平负 decimal odds（主胜/平/客胜）。
需要至少 2 家书商名称 + 三项 decimal 赔率 + 数据来源 URL + 报价时间（若可见）。
仅输出 JSON：{ "bookmakers": [{ "name", "home", "draw", "away", "lastUpdate", "sourceUrl" }], "note" }。
若搜索无法得到可靠 decimal 赔率，bookmakers 留空并在 note 说明原因。`,
  },
  {
    id: "jingcai_odds",
    role: "B-3 竞彩官方盘 semi-auto",
    researchEligible: "maybe_manual",
    directEV: true,
    prompt: `请搜索中国体育彩票竞彩足球（sporttery.cn）是否已开售 2026 世界杯相关场次，重点「墨西哥 vs 南非」。
若可见，提取胜平负(spf)与让球胜平负(rqspf)官方赔率、让球数、停售时间。
仅输出 JSON：{ "found": boolean, "matches": [{ "homeTeam", "awayTeam", "spf": {"win","draw","lose"}, "rqspf": {"handicap","win","draw","lose"}, "stopSaleTime", "sourceUrl" }], "note" }。
查不到官方页面就 found=false。`,
  },
  {
    id: "sentiment",
    role: "B-4 Polymarket 类 sentiment",
    researchEligible: "yes_sentiment_only",
    directEV: false,
    prompt: `搜索 2026 FIFA World Cup winner 预测市场或舆论：Polymarket / 主流媒体对夺冠热门的前 5 队及隐含概率（若可见）。
仅输出 JSON：{ "leaders": [{ "team", "impliedProbability", "source", "sourceUrl" }], "note" }。
这是 sentiment 参考，不是博彩公司 h2h 赔率。`,
  },
];

function extractText(payload) {
  const parts = payload?.candidates?.[0]?.content?.parts || [];
  return parts.map((part) => part.text || "").join("\n").trim();
}

function extractGrounding(payload) {
  const meta = payload?.candidates?.[0]?.groundingMetadata || {};
  return {
    webSearchQueries: meta.webSearchQueries || [],
    groundingChunks: (meta.groundingChunks || []).slice(0, 5).map((chunk) => ({
      title: chunk.web?.title || null,
      uri: chunk.web?.uri || null,
    })),
  };
}

function tryParseJson(text) {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1].trim() : text.trim();
  try {
    return JSON.parse(candidate);
  } catch {
    const start = candidate.indexOf("{");
    const arrayStart = candidate.indexOf("[");
    const idx =
      start === -1 ? arrayStart : arrayStart === -1 ? start : Math.min(start, arrayStart);
    if (idx === -1) {
      return null;
    }
    try {
      return JSON.parse(candidate.slice(idx));
    } catch {
      return null;
    }
  }
}

function assessProbe(probe, parsed, grounding) {
  const hasSources = grounding.groundingChunks.length > 0 || grounding.webSearchQueries.length > 0;
  const issues = [];

  if (!parsed) {
    issues.push("response_not_valid_json");
  }
  if (!hasSources) {
    issues.push("no_grounding_sources");
  }

  let verdict = "unsuitable";
  if (probe.id === "live_fixtures" && Array.isArray(parsed) && parsed.length > 0 && hasSources) {
    verdict = "supplemental_only";
  } else if (probe.id === "live_fixtures" && parsed?.note) {
    verdict = "insufficient";
  } else if (probe.id === "h2h_odds") {
    const count = parsed?.bookmakers?.length || 0;
    verdict = count >= 2 ? "manual_review_required" : "unsuitable_for_ev";
    if (count > 0 && count < 2) {
      issues.push("insufficient_bookmaker_diversity");
    }
  } else if (probe.id === "jingcai_odds") {
    verdict = parsed?.found ? "manual_review_required" : "unsuitable_without_official_page";
  } else if (probe.id === "sentiment") {
    const count = parsed?.leaders?.length || 0;
    verdict = count > 0 ? "sentiment_only_ok" : "insufficient";
  }

  return { verdict, issues, hasSources };
}

async function callGemini(prompt) {
  const url = `${BASE_URL}/models/${MODEL}:generateContent?key=${encodeURIComponent(API_KEY)}`;
  const body = await fetchTextViaHttpsProxy(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      tools: [{ google_search: {} }],
    }),
    timeoutMs: 90000,
    proxyUrl: resolveHttpsProxyUrl(),
  });

  return JSON.parse(body);
}

async function run() {
  if (!API_KEY) {
    console.error(
      JSON.stringify(
        {
          ok: false,
          error: "缺少 GEMINI_API_KEY（或 GOOGLE_API_KEY），请写入 .env 后重试。勿在聊天中粘贴 key。",
        },
        null,
        2,
      ),
    );
    process.exitCode = 1;
    return;
  }

  const results = [];
  for (const probe of PROBES) {
    const startedAt = Date.now();
    try {
      const payload = await callGemini(probe.prompt);
      const text = extractText(payload);
      const grounding = extractGrounding(payload);
      const parsed = tryParseJson(text);
      const assessment = assessProbe(probe, parsed, grounding);

      results.push({
        id: probe.id,
        role: probe.role,
        researchEligible: probe.researchEligible,
        directEV: probe.directEV,
        ms: Date.now() - startedAt,
        assessment,
        parsed,
        grounding,
        rawTextPreview: text.slice(0, 400),
      });
    } catch (error) {
      results.push({
        id: probe.id,
        role: probe.role,
        ms: Date.now() - startedAt,
        error: error.message,
      });
    }
  }

  const summary = {
    ok: results.every((item) => !item.error),
    model: MODEL,
    proxy: describeProxyUsage(resolveHttpsProxyUrl()),
    checkedAt: new Date().toISOString(),
    recommendation: buildRecommendation(results),
    results,
  };

  console.log(JSON.stringify(summary, null, 2));
}

function buildRecommendation(results) {
  const byId = Object.fromEntries(results.map((item) => [item.id, item]));

  return {
    liveData: byId.live_fixtures?.assessment?.verdict || "unknown",
    oddsBackup: byId.h2h_odds?.assessment?.verdict || "unknown",
    jingcaiSemiAuto: byId.jingcai_odds?.assessment?.verdict || "unknown",
    sentiment: byId.sentiment?.assessment?.verdict || "unknown",
    integrateAs: {
      primaryOddsFallback: "不推荐 — 继续 ODDS_PROVIDER=auto → Bzzoiro → snapshot replay",
      liveSupplement: "可考虑 — 仅作 football-data 失败时的人工复核线索，不可 silent fallback",
      jingcaiParser: "可考虑 — semi-auto 草稿 + manualReviewed=true，非实时 API 替代",
      sentimentLayer: "可考虑 — 与 Polymarket 同类，directEVEligible=false",
    },
  };
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
