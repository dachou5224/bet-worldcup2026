import {
  describeProxyUsage,
  fetchTextViaHttpsProxy,
  resolveHttpsProxyUrl,
} from "./https-proxy-fetch.js";

const DEFAULT_BASE_URL = "https://generativelanguage.googleapis.com/v1beta";

export function getGeminiConfig() {
  return {
    apiKey: process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || "",
    model: process.env.GEMINI_MODEL || "gemini-2.5-flash",
    baseUrl: process.env.GEMINI_API_BASE_URL || DEFAULT_BASE_URL,
    proxyUrl: resolveHttpsProxyUrl([
      "GEMINI_HTTPS_PROXY",
      "GEMINI_HTTP_PROXY",
      "POLYMARKET_HTTPS_PROXY",
      "POLYMARKET_HTTP_PROXY",
      "HTTPS_PROXY",
      "https_proxy",
      "HTTP_PROXY",
      "http_proxy",
    ]),
    jingcaiSourceMode: process.env.JINGCAI_GEMINI_SOURCE_MODE || "official",
    jingcaiOfficialDomains: (process.env.JINGCAI_GEMINI_OFFICIAL_DOMAINS || "sporttery.cn,www.sporttery.cn")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean),
    jingcaiOfficialUrls: (process.env.JINGCAI_GEMINI_OFFICIAL_URLS ||
      "https://www.sporttery.cn/jc/zqszsc/,https://www.sporttery.cn/")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean),
  };
}

export function extractGeminiText(payload) {
  const parts = payload?.candidates?.[0]?.content?.parts || [];
  return parts.map((part) => part.text || "").join("\n").trim();
}

export function extractGeminiGrounding(payload) {
  const meta = payload?.candidates?.[0]?.groundingMetadata || {};
  return {
    webSearchQueries: meta.webSearchQueries || [],
    groundingChunks: (meta.groundingChunks || []).slice(0, 8).map((chunk) => ({
      title: chunk.web?.title || null,
      uri: chunk.web?.uri || null,
    })),
  };
}

export function tryParseJsonFromModelText(text) {
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

export async function callGeminiGenerateContent({
  prompt,
  useGoogleSearch = false,
  useUrlContext = false,
  timeoutMs = 90000,
  model,
  apiKey,
  baseUrl,
  proxyUrl,
} = {}) {
  const config = getGeminiConfig();
  const resolvedKey = apiKey || config.apiKey;
  const resolvedModel = model || config.model;
  const resolvedBaseUrl = baseUrl || config.baseUrl;
  const resolvedProxy = proxyUrl ?? config.proxyUrl;

  if (!resolvedKey) {
    throw new Error("缺少 GEMINI_API_KEY，请写入 .env");
  }

  const body = {
    contents: [{ role: "user", parts: [{ text: prompt }] }],
  };

  const tools = [];
  if (useUrlContext) {
    tools.push({ url_context: {} });
  }
  if (useGoogleSearch) {
    tools.push({ google_search: {} });
  }
  if (tools.length) {
    body.tools = tools;
  }

  const url = `${resolvedBaseUrl}/models/${resolvedModel}:generateContent?key=${encodeURIComponent(resolvedKey)}`;
  const responseText = await fetchTextViaHttpsProxy(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    timeoutMs,
    proxyUrl: resolvedProxy,
  });

  const payload = JSON.parse(responseText);
  return {
    payload,
    text: extractGeminiText(payload),
    grounding: extractGeminiGrounding(payload),
    proxy: describeProxyUsage(resolvedProxy),
    model: resolvedModel,
  };
}
