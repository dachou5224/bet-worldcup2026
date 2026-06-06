function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isNumber(value) {
  return typeof value === "number" && Number.isFinite(value);
}

function isString(value) {
  return typeof value === "string" && value.length > 0;
}

function validateLiveMatch(match, index) {
  const path = `liveMatches[${index}]`;
  const errors = [];

  if (!isObject(match)) {
    return [`${path} 必须是对象`];
  }

  if (!isNumber(match.id)) {
    errors.push(`${path}.id 缺失或不是数字`);
  }

  for (const field of ["stage", "status", "venue", "kickoff", "home", "away", "homeScore", "awayScore", "note"]) {
    if (!isString(match[field])) {
      errors.push(`${path}.${field} 缺失或不是字符串`);
    }
  }

  return errors;
}

export function validateLiveMatches(liveMatches) {
  if (!Array.isArray(liveMatches)) {
    return { ok: false, errors: ["liveMatches 必须是数组"] };
  }

  const errors = liveMatches.flatMap((match, index) => validateLiveMatch(match, index));
  return { ok: errors.length === 0, errors };
}
