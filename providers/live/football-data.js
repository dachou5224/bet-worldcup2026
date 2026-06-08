import { fetchJson } from "../../lib/fetch-json.js";
import { getCachedJsonPayload } from "../../lib/local-json-cache.js";
import { toDisplayTeamName } from "../../lib/team-names.js";
let cachedMatchResponse = null;
let cachedMatchResponseAt = 0;
let cachedMatchKey = "";

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function addDays(dateString, days) {
  const date = new Date(`${dateString}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function buildDateWindows(dateFrom, dateTo, maxWindowDays = 10) {
  const windows = [];
  let cursor = dateFrom;

  while (cursor <= dateTo) {
    const end = addDays(cursor, maxWindowDays - 1);
    windows.push({
      dateFrom: cursor,
      dateTo: end < dateTo ? end : dateTo,
    });
    cursor = addDays(end, 1);
  }

  return windows;
}

function mapStatus(status) {
  const statusMap = {
    SCHEDULED: "未开赛",
    TIMED: "已定时",
    IN_PLAY: "进行中",
    PAUSED: "中场/暂停",
    EXTRA_TIME: "加时赛",
    PENALTY_SHOOTOUT: "点球大战",
    FINISHED: "已结束",
    SUSPENDED: "中断",
    POSTPONED: "延期",
    CANCELLED: "取消",
    AWARDED: "判定结果",
  };

  return statusMap[status] || status || "未知状态";
}

const STAGE_LABELS = {
  GROUP_STAGE: "小组赛",
  LAST_32: "三十二强",
  LAST_16: "十六强",
  QUARTER_FINALS: "四分之一决赛",
  SEMI_FINALS: "半决赛",
  THIRD_PLACE: "三四名决赛",
  FINAL: "决赛",
};

function mapStage(match) {
  return STAGE_LABELS[match.stage] || match.stage || match.competition?.name || "世界杯赛程";
}

function mapGroupLetter(group) {
  if (!group) {
    return null;
  }
  const match = String(group).match(/GROUP_([A-L])/i);
  return match ? match[1].toUpperCase() : null;
}

function getScore(match, side) {
  const fullTime = match.score?.fullTime || {};
  const value = side === "home" ? fullTime.home : fullTime.away;
  return value == null ? "-" : String(value);
}

function parseRateLimitWaitSeconds(error) {
  const message = error?.message || "";
  const match = message.match(/Wait\s+(\d+)\s+seconds/i);
  if (!match) {
    return null;
  }

  const seconds = Number(match[1]);
  return Number.isFinite(seconds) ? seconds : null;
}

async function fetchMatchesWindow(config, window, attemptsRemaining = 1) {
  const params = new URLSearchParams({
    dateFrom: window.dateFrom,
    dateTo: window.dateTo,
  });

  const competitionCode = config.footballDataCompetitionCode || "WC";
  const url = `${config.footballDataApiBaseUrl}/competitions/${competitionCode}/matches?${params.toString()}`;

  try {
    return await fetchJson(url, {
      timeoutMs: 20000,
      headers: {
        "X-Auth-Token": config.footballDataApiKey,
      },
    });
  } catch (error) {
    const waitSeconds = parseRateLimitWaitSeconds(error);
    if (attemptsRemaining > 0 && waitSeconds != null && waitSeconds <= 35) {
      await sleep((waitSeconds + 1) * 1000);
      return fetchMatchesWindow(config, window, attemptsRemaining - 1);
    }

    throw error;
  }
}

function buildCacheKey(config) {
  return [
    config.footballDataApiBaseUrl,
    config.footballDataCompetitionCode || "WC",
    config.footballDataDateFrom,
    config.footballDataDateTo,
  ].join("|");
}

export function createFootballDataLiveProviderAdapter(config) {
  return {
    id: "football_data_live",
    isConfigured() {
      return Boolean(config.footballDataApiKey);
    },
    async fetchRawMatches() {
      if (!this.isConfigured()) {
        throw new Error("football-data.org API key 未配置");
      }

      const cacheKey = buildCacheKey(config);
      if (
        cachedMatchResponse &&
        cachedMatchKey === cacheKey &&
        Date.now() - cachedMatchResponseAt < 60_000
      ) {
        return cachedMatchResponse;
      }

      const windows = buildDateWindows(
        config.footballDataDateFrom,
        config.footballDataDateTo,
        10,
      );
      cachedMatchResponse = await getCachedJsonPayload({
        namespace: "football-data-live",
        cacheKey,
        ttlSeconds: config.footballDataCacheTtlSeconds,
        enabled: config.providerCacheEnabled,
        cacheDir: config.providerCacheDir,
        fetcher: async () => {
          const allMatches = [];

          for (const window of windows) {
            const response = await fetchMatchesWindow(config, window);

            const matches = Array.isArray(response.body.matches) ? response.body.matches : [];
            allMatches.push(...matches);
          }

          return { matches: allMatches };
        },
      });
      cachedMatchResponseAt = Date.now();
      cachedMatchKey = cacheKey;

      return cachedMatchResponse;
    },
    async fetchNormalizedLiveMatches() {
      const body = await this.fetchRawMatches();
      const rows = Array.isArray(body.matches) ? body.matches : [];

      if (!rows.length) {
        throw new Error(
          `football-data.org 未返回 ${config.footballDataCompetitionCode || "WC"} 在 ${config.footballDataDateFrom} ~ ${config.footballDataDateTo} 的赛程`,
        );
      }

      return rows.map((match) => ({
        id: match.id,
        externalMatchId: match.id,
        stageCode: match.stage || null,
        groupCode: match.group || null,
        groupLetter: mapGroupLetter(match.group),
        matchday: match.matchday ?? null,
        stage: mapStage(match),
        status: mapStatus(match.status),
        venue: match.venue || match.competition?.name || "场地待定",
        kickoff: match.utcDate || "时间待定",
        home: toDisplayTeamName(match.homeTeam?.name || "Home TBD"),
        away: toDisplayTeamName(match.awayTeam?.name || "Away TBD"),
        homeScore: getScore(match, "home"),
        awayScore: getScore(match, "away"),
        note: "来自 football-data.org 实时比赛源，按赛事窗口输出完整赛程。",
      }));
    },
  };
}
