export function buildFixtureKey(home, away) {
  return `${String(home).trim()}__${String(away).trim()}`;
}

export function buildFixtureLabel(home, away) {
  return `${home} vs ${away}`;
}
