const Query = require("./Query");

class Socket {
  constructor(socket, server) {
    this.socket = socket;
    this.server = server;
  }

  listen() {
    let string = "";

    this.socket.on("data", (buffer) => {
      try {
        string += buffer.toString();
      } catch (error) {
        return;
      }

      if (!string.includes("\x00")) {
        return;
      }

      const split = string.split("\x00");

      for (let i = 0; i < split.length - 1; i++) {
        const json = split[i];

        this.parse(json);
      }

      string = split[split.length - 1];
    });

    this.socket.on("error", () => {});
  }

  parse(json) {
    try {
      const object = JSON.parse(json);

      if (!this.isQuery(object)) {
        return;
      }

      this.query(object);
    } catch (error) {}
  }

  authenticate(object) {
    const {
      auth: { username: tmpUsername, password: tmpPassword },
    } = object;

    const username = this.server.getUsername();
    const password = this.server.getPassword();

    return tmpUsername === username && tmpPassword === password;
  }

  async query(object) {
    const {
      id,
      query: {
        database: databaseName,
        collection: collectionName,
        action,
        params,
      },
    } = object;

    const size = this.server.getMaxDocumentsCount();

    try {
      if (!this.authenticate(object)) {
        throw new Error("Unable to authenticate.");
      }

      const query = new Query(
        databaseName,
        collectionName,
        action,
        params,
        this.server
      );

      const data = await query.run();

      if (Array.isArray(data)) {
        const chunks = this.chunk(data, size);

        this.write({ id, data: [] });

        for (const data of chunks) {
          this.write({ id, data });
        }
      } else {
        this.write({ id, data });
      }
    } catch (error) {
      this.write({ id, error: { message: error.message } });
    } finally {
      this.write({ id, ended: true });
    }
  }

  write({ id, data = null, error = null, ended = false }) {
    const string = JSON.stringify({ id, data, error, ended });

    this.socket.write(`${string}\x00`);
  }

  chunk(array, size) {
    const chunks = [];

    for (let i = 0; i < array.length; i += size) {
      const chunk = array.slice(i, i + size);

      chunks.push(chunk);
    }

    return chunks;
  }

  isObject(object) {
    return (
      object !== null && typeof object === "object" && !Array.isArray(object)
    );
  }

  isQuery(object) {
    if (!this.isObject(object)) {
      return false;
    }

    if (Object.keys(object).length !== 3) {
      return false;
    }

    return (
      typeof object.id === "string" &&
      this.isObject(object.auth) &&
      this.isObject(object.query)
    );
  }
}

module.exports = Socket;
