export default {
  async read(source) {
    return source;
  },

  async normalize(data) {
    if (typeof data !== "string") {
      return data;
    }

    try {
      return JSON.parse(data);
    } catch {
      return data;
    }
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
