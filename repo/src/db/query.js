function hasOwn(obj, key) {
  return Object.prototype.hasOwnProperty.call(obj, key);
}

function evaluateOperator(value, operator, expected) {
  switch (operator) {
    case "$eq":
      return value === expected;
    case "$ne":
      return value !== expected;
    case "$in":
      return Array.isArray(expected) && expected.includes(value);
    case "$nin":
      return Array.isArray(expected) && !expected.includes(value);
    case "$gt":
      return value > expected;
    case "$gte":
      return value >= expected;
    case "$lt":
      return value < expected;
    case "$lte":
      return value <= expected;
    case "$contains":
      return (
        typeof value === "string" && String(value).includes(String(expected))
      );
    default:
      return false;
  }
}

export function matchesQuery(document, query = {}) {
  const entries = Object.entries(query);

  if (entries.length === 0) {
    return true;
  }

  return entries.every(([field, condition]) => {
    const value = document[field];

    if (
      typeof condition === "object" &&
      condition !== null &&
      !Array.isArray(condition)
    ) {
      return Object.entries(condition).every(([op, expected]) =>
        evaluateOperator(value, op, expected),
      );
    }

    if (!hasOwn(document, field)) {
      return false;
    }

    return value === condition;
  });
}

function normalizeSort(sort) {
  if (!sort) {
    return [];
  }

  if (Array.isArray(sort)) {
    return sort;
  }

  return Object.entries(sort).map(([field, direction]) => ({
    field,
    direction,
  }));
}

function compareValues(a, b) {
  if (a === b) {
    return 0;
  }

  if (a === undefined || a === null) {
    return 1;
  }

  if (b === undefined || b === null) {
    return -1;
  }

  if (a > b) {
    return 1;
  }

  if (a < b) {
    return -1;
  }

  return 0;
}

export function applyQueryOptions(documents, options = {}) {
  const sortConfig = normalizeSort(options.sort);
  const pageSize = options.pageSize ?? options.limit;
  const page = options.page ?? 1;
  const skipFromPage = pageSize ? (Math.max(page, 1) - 1) * pageSize : 0;
  const skip = options.skip ?? skipFromPage;
  const limit = options.limit ?? pageSize ?? documents.length;

  let working = [...documents];

  if (sortConfig.length > 0) {
    working.sort((left, right) => {
      for (const { field, direction } of sortConfig) {
        const dir =
          direction === -1 || String(direction).toLowerCase() === "desc"
            ? -1
            : 1;
        const compared = compareValues(left[field], right[field]);

        if (compared !== 0) {
          return compared * dir;
        }
      }

      return 0;
    });
  }

  return working.slice(skip, skip + Math.max(limit, 0));
}
