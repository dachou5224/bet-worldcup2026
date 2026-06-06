import { fetchJson } from "../../lib/fetch-json.js";

function getParticipantName(participants, location) {
  const participant = (participants || []).find((item) => item.meta?.location === location);
  return participant?.name || (location === "home" ? "主队待定" : "客队待定");
}

function getScoreValue(scores, participantName) {
  const score = (scores || []).find((item) => item.participant?.name === participantName);
  return score?.score?.goals != null ? String(score.score.goals) : "-";
}

export function createSportmonksLiveProviderAdapter(config) {
  return {
    id: "sportmonks_live",
    isConfigured() {
      return Boolean(config.sportmonksApiToken);
    },
    async fetchRawFixtures() {
      if (!this.isConfigured()) {
        throw new Error("Sportmonks API token 未配置");
      }

      const params = new URLSearchParams({
        api_token: config.sportmonksApiToken,
        include: "participants;scores",
        per_page: "50",
      });

      const url = `${config.sportmonksApiBaseUrl}/fixtures/between/${config.sportmonksStartDate}/${config.sportmonksEndDate}?${params.toString()}`;
      const response = await fetchJson(url, { timeoutMs: 20000 });
      return response.body;
    },
    async fetchNormalizedLiveMatches() {
      const responseBody = await this.fetchRawFixtures();
      const rows = Array.isArray(responseBody.data)
        ? responseBody.data
        : responseBody.data
          ? [responseBody.data]
          : [];

      return rows.map((fixture) => {
        const home = getParticipantName(fixture.participants, "home");
        const away = getParticipantName(fixture.participants, "away");

        return {
          id: fixture.id,
          stage: fixture.stage?.name || fixture.round?.name || "世界杯赛程",
          status: fixture.state?.name || "未开赛",
          venue: fixture.venue?.name || "场地待定",
          kickoff: fixture.starting_at || fixture.starting_at_timestamp || "时间待定",
          home,
          away,
          homeScore: getScoreValue(fixture.scores, home),
          awayScore: getScoreValue(fixture.scores, away),
          note: "来自 Sportmonks 实时赛程/比分源。",
        };
      });
    },
  };
}
