const path = require("node:path");

const fsp = require("node:fs/promises");

const Collection = require("./Collection");

class Database {
  constructor(name, server) {
    this.name = name;

    this.server = server;

    this.collections = new Map();
  }

  getDir() {
    const dir = this.server.getDir();

    return path.resolve(dir, this.name);
  }

  createCollection(name) {
    const collection = new Collection(name, this);

    this.collections.set(name, collection);

    return collection;
  }

  ensureCollection(name) {
    if (this.collections.has(name)) {
      return this.collections.get(name);
    }

    return this.createCollection(name);
  }

  async read() {
    const dir = this.getDir();

    try {
      await fsp.access(dir);
    } catch (error) {
      return;
    }

    const names = await fsp.readdir(dir);

    const promises = [];

    for (const name of names) {
      const collection = this.createCollection(name);

      promises.push(collection.read());
    }

    await Promise.all(promises);
  }
}

module.exports = Database;
