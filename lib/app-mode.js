export function normalizeAppMode(value) {
  return value === "research" ? "research" : "demo";
}

export function allowsProviderFallback(appMode) {
  return normalizeAppMode(appMode) === "demo";
}
