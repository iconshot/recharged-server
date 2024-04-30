const net = require("node:net");

const fsp = require("node:fs/promises");

const Database = require("./Database");
const Socket = require("./Socket");

class Server {
  constructor({ dir, username, password, port }) {
    this.dir = dir;

    this.username = username;
    this.password = password;

    this.port = port;

    this.maxFileSize = 524288000; // 500 mb
    this.maxDocumentSize = 1048576; // 1 mb

    const floor = Math.floor(this.maxFileSize / this.maxDocumentSize);

    this.maxDocumentsCount = floor - 1; // make room for [] and commas

    this.databases = new Map();
  }

  getDir() {
    return this.dir;
  }

  getUsername() {
    return this.username;
  }

  getPassword() {
    return this.password;
  }

  getMaxDocumentSize() {
    return this.maxDocumentSize;
  }

  getMaxDocumentsCount() {
    return this.maxDocumentsCount;
  }

  createDatabase(name) {
    const database = new Database(name, this);

    this.databases.set(name, database);

    return database;
  }

  ensureDatabase(name) {
    if (this.databases.has(name)) {
      return this.databases.get(name);
    }

    return this.createDatabase(name);
  }

  async read() {
    try {
      await fsp.access(this.dir);
    } catch (error) {
      return;
    }

    const names = await fsp.readdir(this.dir);

    const tmpNames = names.filter((name) => !name.startsWith("."));

    const promises = [];

    for (const name of tmpNames) {
      const database = this.createDatabase(name);

      promises.push(database.read());
    }

    await Promise.all(promises);
  }

  async start() {
    await this.read();
    await this.serve();
  }

  serve() {
    return new Promise((resolve, reject) => {
      const server = net.createServer((socket) => {
        const tmpSocket = new Socket(socket, this);

        tmpSocket.listen();
      });

      server.on("error", reject);

      server.listen(this.port, resolve);
    });
  }
}

module.exports = Server;
