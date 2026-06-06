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

function validateOpinion(opinion, path) {
  const errors = [];

  if (!isObject(opinion)) {
    return [`${path} 必须是对象`];
  }

  for (const field of ["pundit", "region", "stance", "confidence", "capturedAt", "summary"]) {
    if (!isString(opinion[field])) {
      errors.push(`${path}.${field} 缺失或不是字符串`);
    }
  }

  if (!Array.isArray(opinion.signalTags)) {
    errors.push(`${path}.signalTags 缺失或不是数组`);
  }

  return errors;
}

function validateOpinionGroup(group, index) {
  const path = `expertOpinions[${index}]`;
  const errors = [];

  if (!isObject(group)) {
    return [`${path} 必须是对象`];
  }

  if (!isIdentifier(group.fixtureId)) {
    errors.push(`${path}.fixtureId 缺失或不是字符串/数字`);
  }

  for (const field of ["fixture", "sourceType"]) {
    if (!isString(group[field])) {
      errors.push(`${path}.${field} 缺失或不是字符串`);
    }
  }

  if (!Array.isArray(group.opinions)) {
    errors.push(`${path}.opinions 缺失或不是数组`);
  } else {
    group.opinions.forEach((opinion, opinionIndex) => {
      errors.push(...validateOpinion(opinion, `${path}.opinions[${opinionIndex}]`));
    });
  }

  return errors;
}

export function validateExpertOpinions(expertOpinions) {
  if (!Array.isArray(expertOpinions)) {
    return { ok: false, errors: ["expertOpinions 必须是数组"] };
  }

  const errors = expertOpinions.flatMap((group, index) => validateOpinionGroup(group, index));
  return { ok: errors.length === 0, errors };
}
