export default {
  async read(source) {
    if (source === undefined || source === null) {
      return null;
    }

    if (typeof source === "object") {
      return JSON.parse(JSON.stringify(source));
    }

    return String(source);
  },

  async normalize(data) {
    return data;
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
