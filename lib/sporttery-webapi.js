import { fetchJson } from "./fetch-json.js";

export const SPORTTERY_WEBAPI_BASE_URL =
  process.env.SPORTTERY_WEBAPI_BASE_URL || "https://webapi.sporttery.cn";
export const SPORTTERY_CLIENT_CODE = process.env.SPORTTERY_CLIENT_CODE || "3001";

export function getSportteryMatchListUrl(clientCode = SPORTTERY_CLIENT_CODE) {
  return `${SPORTTERY_WEBAPI_BASE_URL}/gateway/uniform/football/getMatchListV1.qry?clientCode=${encodeURIComponent(clientCode)}`;
}

export async function fetchSportteryFootballMatchList(options = {}) {
  const url = options.url || getSportteryMatchListUrl(options.clientCode);
  const response = await fetchJson(url, {
    timeoutMs: options.timeoutMs || 30000,
    headers: {
      Accept: "application/json",
      Referer: "https://www.sporttery.cn/jc/jsq/zqspf/",
      Origin: "https://www.sporttery.cn",
      "User-Agent":
        options.userAgent ||
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
    },
  });

  const body = response.body;
  if (!body || body.errorCode !== "0") {
    throw new Error(
      `Sporttery webapi 错误: ${body?.errorMessage || body?.errorCode || "unknown"}`,
    );
  }

  return {
    capturedAt: new Date().toISOString(),
    url,
    body,
  };
}

export function flattenSportteryMatchList(payload) {
  const matchInfoList = payload?.value?.matchInfoList || [];
  const matches = [];

  for (const day of matchInfoList) {
    for (const match of day.subMatchList || []) {
      matches.push({
        ...match,
        businessDate: match.businessDate || day.businessDate || null,
      });
    }
  }

  return matches;
}

export function findOddsPool(match, poolCode) {
  return (match.oddsList || []).find((item) => item.poolCode === poolCode) || null;
}

export function findPoolStatus(match, poolCode) {
  return (match.poolList || []).find((item) => item.poolCode === poolCode) || null;
}
