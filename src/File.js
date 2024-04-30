const path = require("node:path");

const fsp = require("node:fs/promises");

class File {
  constructor(index, collection) {
    this.index = index;

    this.collection = collection;

    this.documents = [];
  }

  getDocuments() {
    return this.documents;
  }

  setDocuments(documents) {
    this.documents = documents;
  }

  getFile() {
    const dir = this.collection.getDir();

    return path.resolve(dir, `${this.index}.json`);
  }

  async read() {
    const file = this.getFile();

    const json = await fsp.readFile(file, { encoding: "utf-8" });

    if (json.length === 0) {
      throw new Error("Empty file content.");
    }

    this.documents = JSON.parse(json);
  }

  async write() {
    const file = this.getFile();

    const dir = path.dirname(file);

    await fsp.mkdir(dir, { recursive: true });

    const json = JSON.stringify(this.documents);

    await fsp.writeFile(file, json);
  }
}

module.exports = File;
