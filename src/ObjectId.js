const { Buffer } = require("node:buffer");

const crypto = require("node:crypto");

class ObjectId {
  static index = Math.floor(Math.random() * 0xffffff);

  static random = crypto.randomBytes(5);

  static generate() {
    const time = Math.floor(Date.now() / 1000);

    const buffer = Buffer.alloc(12);

    const dataView = new DataView(
      buffer.buffer,
      buffer.byteOffset,
      buffer.byteLength
    );

    // 4-byte timestamp

    dataView.setUint32(0, time, false);

    // 5-byte random

    buffer[4] = this.random[0];
    buffer[5] = this.random[1];
    buffer[6] = this.random[2];
    buffer[7] = this.random[3];
    buffer[8] = this.random[4];

    // 3-byte index

    buffer[11] = this.index & 0xff;
    buffer[10] = (this.index >> 8) & 0xff;
    buffer[9] = (this.index >> 16) & 0xff;

    this.index = (this.index + 1) % 0xffffff;

    return buffer.toString("hex");
  }

  static test(id) {
    const regex = /^[0-9a-fA-F]{24}$/;

    return typeof id === "string" && regex.test(id);
  }
}

module.exports = ObjectId;
