export function createPolymarketProviderAdapter() {
  return {
    id: "polymarket_provider_placeholder",
    isConfigured() {
      return false;
    },
    async fetchMarkets() {
      return [];
    },
  };
}
