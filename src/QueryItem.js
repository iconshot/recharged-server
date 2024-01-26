class QueryItem {
  constructor(document, file, index) {
    this.document = document;
    this.file = file;
    this.index = index;
  }

  getDocument() {
    return this.document;
  }

  getFile() {
    return this.file;
  }

  getIndex() {
    return this.index;
  }

  setDocument(document) {
    this.document = document;
  }
}

module.exports = QueryItem;
