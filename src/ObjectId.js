class ObjectId {
  static test(id) {
    const regex = /^[0-9a-fA-F]{24}$/;

    return typeof id === "string" && regex.test(id);
  }

  // source: https://stackoverflow.com/a/37438675/16703278

  static generate(
    m = Math,
    d = Date,
    h = 16,
    s = (s) => m.floor(s).toString(h)
  ) {
    return (
      s(d.now() / 1000) + " ".repeat(h).replace(/./g, () => s(m.random() * h))
    );
  }
}

module.exports = ObjectId;
