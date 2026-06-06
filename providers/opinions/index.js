export function createOpinionProviderAdapter() {
  return {
    id: "opinion_provider_placeholder",
    isConfigured() {
      return false;
    },
    async fetchOpinions() {
      return [];
    },
  };
}
