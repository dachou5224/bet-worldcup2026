export function createOddsProviderAdapter() {
  return {
    id: "odds_provider_placeholder",
    isConfigured() {
      return false;
    },
    async fetchUpcomingOdds() {
      return [];
    },
  };
}
