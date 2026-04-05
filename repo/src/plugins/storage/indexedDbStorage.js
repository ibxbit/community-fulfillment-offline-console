export default {
  async read(source) {
    return source;
  },

  async normalize(data) {
    return data;
  },

  async write(target, data) {
    if (!target) {
      throw new Error("Storage target is required");
    }

    if (Array.isArray(data) && typeof target.insertMany === "function") {
      return target.insertMany(data);
    }

    if (typeof target.insertOne === "function") {
      return target.insertOne(data);
    }

    throw new Error("Target does not support plugin write operation");
  },
};
