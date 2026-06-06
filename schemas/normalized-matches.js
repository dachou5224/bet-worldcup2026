function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isNumber(value) {
  return typeof value === "number" && Number.isFinite(value);
}

function isString(value) {
  return typeof value === "string" && value.length > 0;
}

function isIdentifier(value) {
  return isNumber(value) || isString(value);
}

function validateNormalizedMatch(match, index) {
  const path = `normalizedMatches[${index}]`;
  const errors = [];

  if (!isObject(match)) {
    return [`${path} 必须是对象`];
  }

  if (!isIdentifier(match.fixtureId)) {
    errors.push(`${path}.fixtureId 缺失或不是字符串/数字`);
  }

  for (const field of ["fixture", "kickoffLabel", "tournamentStatus", "freshnessLabel", "derivedAt"]) {
    if (!isString(match[field])) {
      errors.push(`${path}.${field} 缺失或不是字符串`);
    }
  }

  if (!isObject(match.consensus)) {
    errors.push(`${path}.consensus 缺失或不是对象`);
  }

  if (!isObject(match.providers)) {
    errors.push(`${path}.providers 缺失或不是对象`);
  }

  if (!isObject(match.expertOpinionSummary)) {
    errors.push(`${path}.expertOpinionSummary 缺失或不是对象`);
  }

  if (!Array.isArray(match.expertOpinions)) {
    errors.push(`${path}.expertOpinions 缺失或不是数组`);
  }

  if (!isObject(match.rawSources)) {
    errors.push(`${path}.rawSources 缺失或不是对象`);
  }

  return errors;
}

export function validateNormalizedMatches(normalizedMatches) {
  if (!Array.isArray(normalizedMatches)) {
    return { ok: false, errors: ["normalizedMatches 必须是数组"] };
  }

  const errors = normalizedMatches.flatMap((match, index) => validateNormalizedMatch(match, index));
  return { ok: errors.length === 0, errors };
}
