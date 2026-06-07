function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isNumber(value) {
  return typeof value === "number" && Number.isFinite(value);
}

function isString(value) {
  return typeof value === "string" && value.length > 0;
}

function isOptionalString(value) {
  return value == null || isString(value);
}

function isOptionalNumber(value) {
  return value == null || isNumber(value);
}

function validateOddsMap(odds, path) {
  const errors = [];

  if (!isObject(odds)) {
    return [`${path} 必须是对象`];
  }

  for (const [key, value] of Object.entries(odds)) {
    if (!isNumber(value) || value <= 0) {
      errors.push(`${path}.${key} 必须是大于 0 的数字`);
    }
  }

  return errors;
}

function validatePlay(play, path) {
  const errors = [];

  if (!isObject(play)) {
    return [`${path} 必须是对象`];
  }

  if (typeof play.onSale !== "boolean") {
    errors.push(`${path}.onSale 缺失或不是布尔值`);
  }

  if (!isOptionalNumber(play.handicap)) {
    errors.push(`${path}.handicap 不是数字或 null`);
  }

  if (!isObject(play.odds)) {
    errors.push(`${path}.odds 必须是对象`);
  } else {
    errors.push(...validateOddsMap(play.odds, `${path}.odds`));
  }

  return errors;
}

function validateRecord(record, index) {
  const path = `jingcaiOfficialFeed[${index}]`;
  const errors = [];

  if (!isObject(record)) {
    return [`${path} 必须是对象`];
  }

  for (const field of ["jingcaiMatchId", "competition", "stage", "homeTeam", "awayTeam", "kickoffLocal", "saleStatus", "ruleVersion"]) {
    if (field === "ruleVersion") {
      if (!isOptionalString(record[field])) {
        errors.push(`${path}.${field} 不是字符串或 null`);
      }
      continue;
    }

    if (!isString(record[field])) {
      errors.push(`${path}.${field} 缺失或不是字符串`);
    }
  }

  if (record.fixtureId == null || (typeof record.fixtureId !== "number" && typeof record.fixtureId !== "string")) {
    errors.push(`${path}.fixtureId 缺失或不是字符串/数字`);
  }

  if (!isOptionalString(record.stopSaleTime)) {
    errors.push(`${path}.stopSaleTime 不是字符串或 null`);
  }

  if (!isObject(record.availablePlays)) {
    errors.push(`${path}.availablePlays 必须是对象`);
  } else {
    for (const playKey of ["spf", "rqspf", "zjq", "bf", "bqc"]) {
      if (!(playKey in record.availablePlays)) {
        errors.push(`${path}.availablePlays.${playKey} 缺失`);
        continue;
      }

      errors.push(...validatePlay(record.availablePlays[playKey], `${path}.availablePlays.${playKey}`));
    }
  }

  if (!isOptionalString(record.fetchedAt)) {
    errors.push(`${path}.fetchedAt 不是字符串或 null`);
  }

  return errors;
}

export function validateJingcaiOfficialFeed(feed) {
  if (!Array.isArray(feed)) {
    return {
      ok: false,
      errors: ["jingcaiOfficialFeed 必须是数组"],
    };
  }

  const errors = feed.flatMap((record, index) => validateRecord(record, index));

  return {
    ok: errors.length === 0,
    errors,
  };
}
