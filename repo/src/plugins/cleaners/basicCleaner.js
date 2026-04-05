function cleanValue(value) {
  if (Array.isArray(value)) {
    return value.map((item) => cleanValue(item));
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, nextValue]) => [
        key,
        cleanValue(nextValue),
      ]),
    );
  }

  if (typeof value === "string") {
    return value.trim();
  }

  return value;
}

export default {
  async read(source) {
    return source;
  },

  async normalize(data) {
    return cleanValue(data);
  },

  async write(target, data) {
    if (!target) {
      return data;
    }

    if (typeof target.insertMany === "function" && Array.isArray(data)) {
      return target.insertMany(data);
    }

    if (typeof target.insertOne === "function") {
      return target.insertOne(data);
    }

    return data;
  },
};
