const path = require("node:path");

const fsp = require("node:fs/promises");

const File = require("./File");

class Collection {
  constructor(name, database) {
    this.name = name;

    this.database = database;

    this.files = [];

    // queue

    this.actions = [];

    this.running = false;
  }

  getFiles() {
    return this.files;
  }

  getDir() {
    const dir = this.database.getDir();

    return path.resolve(dir, this.name);
  }

  createFile() {
    const index = this.files.length;

    const file = new File(index, this);

    this.files.push(file);

    return file;
  }

  async read() {
    const dir = this.getDir();

    try {
      await fsp.access(dir);
    } catch (error) {
      return;
    }

    const files = await fsp.readdir(dir);

    const promises = [];

    for (let i = 0; i < files.length; i++) {
      const file = this.createFile();

      const read = async () => {
        try {
          await file.read();
        } catch (error) {
          await read();
        }
      };

      promises.push(read());
    }

    await Promise.all(promises);
  }

  queue(action) {
    this.actions.push(action);

    this.run();
  }

  async run() {
    if (this.running) {
      return;
    }

    if (this.actions.length === 0) {
      return;
    }

    this.running = true;

    const action = this.actions.shift();

    await action.run();

    this.running = false;

    this.run();
  }
}

module.exports = Collection;
