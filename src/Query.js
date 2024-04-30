const Action = require("./Action");
const ObjectId = require("./ObjectId");
const Validator = require("./Validator");
const QueryItem = require("./QueryItem");

class Query {
  constructor(databaseName, collectionName, action, params, server) {
    this.action = action;

    if (
      !(params !== null && typeof params === "object" && !Array.isArray(params))
    ) {
      throw new Error('Query "params" should be an object.');
    }

    this.params = Validator.validate(params);

    this.collection = this.ensureCollection(
      server,
      databaseName,
      collectionName
    );

    this.encoder = new TextEncoder();

    this.server = server;
  }

  ensureCollection(server, databaseName, collectionName) {
    const database = server.ensureDatabase(databaseName);

    return database.ensureCollection(collectionName);
  }

  async run() {
    return new Promise((resolve, reject) => {
      const closure = async () => {
        switch (this.action) {
          case "create": {
            return await this.create();

            break;
          }

          case "read": {
            return await this.read();

            break;
          }

          case "update": {
            return await this.update();

            break;
          }

          case "delete": {
            return await this.delete();

            break;
          }

          case "count": {
            return await this.count();

            break;
          }

          default: {
            throw new Error("Invalid query action.");

            break;
          }
        }
      };

      const action = new Action(closure, resolve, reject);

      this.collection.queue(action);
    });
  }

  async create() {
    const { create } = this.params;

    if (create === null) {
      throw new Error('Param "create" must be an array of documents.');
    }

    const documents = create.map((document) => this.encode(document));

    const maxDocumentsCount = this.server.getMaxDocumentsCount();

    const files = [];

    loop: for (const document of documents) {
      const tmpFiles = this.collection.getFiles();

      if (tmpFiles.length === 0) {
        const file = this.collection.createFile();

        file.setDocuments([document]);

        files.push(file);

        continue loop;
      }

      for (let i = tmpFiles.length - 1; i >= 0; i--) {
        const file = tmpFiles[i];

        const tmpDocuments = file.getDocuments();

        if (tmpDocuments.length === maxDocumentsCount) {
          continue;
        }

        file.setDocuments([...tmpDocuments, document]);

        files.push(file);

        continue loop;
      }

      const file = this.collection.createFile();

      file.setDocuments([document]);

      files.push(file);
    }

    const promises = files
      .filter((file, i) => files.indexOf(file) === i)
      .map((file) => file.write());

    await Promise.all(promises);

    return documents;
  }

  async read() {
    const items = this.scan();

    return items.map((item) => item.getDocument());
  }

  async update() {
    const { update } = this.params;

    if (update === null) {
      return 0;
    }

    const items = this.scan();

    if (items.length === 0) {
      return 0;
    }

    for (const item of items) {
      const document = item.getDocument();

      const tmpDocument = this.encode(this.apply(document));

      item.setDocument(tmpDocument);
    }

    const files = items
      .map((item) => item.getFile())
      .filter((file, i, files) => files.indexOf(file) === i);

    for (const file of files) {
      const tmpItems = items.filter((item) => item.getFile() === file);

      const documents = tmpItems.map((item) => item.getDocument());

      const indexes = tmpItems.map((item) => item.getIndex());

      const tmpDocuments = [...file.getDocuments()];

      for (let i = 0; i < documents.length; i++) {
        const document = documents[i];
        const index = indexes[i];

        tmpDocuments[index] = document;
      }

      file.setDocuments(tmpDocuments);
    }

    const promises = files.map((file) => file.write());

    await Promise.all(promises);

    return items.length;
  }

  async delete() {
    const items = this.scan();

    if (items.length === 0) {
      return 0;
    }

    const files = items
      .map((item) => item.getFile())
      .filter((file, i, files) => files.indexOf(file) === i);

    for (const file of files) {
      const tmpItems = items.filter((item) => item.getFile() === file);

      const documents = tmpItems.map((item) => item.getDocument());

      const tmpDocuments = file
        .getDocuments()
        .filter((document) => !documents.includes(document));

      file.setDocuments(tmpDocuments);
    }

    const promises = files.map((file) => file.write());

    await Promise.all(promises);

    return items.length;
  }

  async count() {
    const items = this.scan();

    return items.length;
  }

  scan() {
    const { limit, skip, sort } = this.params;

    const files = this.collection.getFiles();

    if (files.length === 0) {
      return [];
    }

    if (limit === 0) {
      return [];
    }

    // a possible sharding system could retrieve documents from different machines

    const items = [];

    for (const file of files) {
      const documents = file.getDocuments();

      for (let i = 0; i < documents.length; i++) {
        const document = documents[i];

        if (!this.find(document)) {
          continue;
        }

        const item = new QueryItem(document, file, i);

        items.push(item);
      }
    }

    if (sort !== null) {
      const documents = items.map((item) => item.getDocument());

      this.sort(documents);

      items.sort((a, b) => {
        const documentA = a.getDocument();
        const documentB = b.getDocument();

        return documents.indexOf(documentA) - documents.indexOf(documentB);
      });
    }

    if (limit === null) {
      return items.slice(skip);
    }

    return items.slice(skip, skip + limit);
  }

  find(document) {
    const { find } = this.params;

    if (find === null) {
      return true;
    }

    return this.findRules(document, find, document);
  }

  findRules(target, rules, document) {
    const keys = Object.keys(rules);

    return keys.every((key) => {
      switch (key) {
        // logical operators

        // all of them true -> true, otherwise false

        case "$and": {
          const array = rules[key];

          return array.every((rules) =>
            this.findRules(target, rules, document)
          );

          break;
        }

        // all of them true -> false, otherwise true

        case "$nand": {
          const array = rules[key];

          return !array.every((rules) =>
            this.findRules(target, rules, document)
          );

          break;
        }

        // at least one true -> true, otherwise false

        case "$or": {
          const array = rules[key];

          return array.some((rules) => this.findRules(target, rules, document));

          break;
        }

        // at least one true -> false, otherwise true

        case "$nor": {
          const array = rules[key];

          return !array.some((rules) =>
            this.findRules(target, rules, document)
          );

          break;
        }

        // $this: { operators }

        case "$this": {
          const operators = rules[key];

          return this.findOperators(target, operators, document);

          break;
        }

        // property: { operators }

        default: {
          const operators = rules[key];

          const value = this.findValue(target, document, key);

          return this.findOperators(value, operators, document);

          break;
        }
      }
    });
  }

  findOperators(value, operators, document) {
    const keys = Object.keys(operators);

    return keys.every((key) => {
      const argument = operators[key];

      switch (key) {
        // comparison operators

        case "$eq": {
          return value === argument;

          break;
        }

        case "$ne": {
          return value !== argument;

          break;
        }

        case "$gt": {
          return value > argument;

          break;
        }

        case "$lt": {
          return value < argument;

          break;
        }

        case "$gte": {
          return value >= argument;

          break;
        }

        case "$lte": {
          return value <= argument;

          break;
        }

        // negate operator

        case "$not": {
          return !this.findOperators(value, argument, document);

          break;
        }

        // inclusion operators

        case "$in": {
          return argument.includes(value);

          break;
        }

        case "$nin": {
          return !argument.includes(value);

          break;
        }

        case "$all": {
          if (!Array.isArray(value)) {
            return false;
          }

          return value.every((element) => argument.includes(element));

          break;
        }

        case "$includes": {
          if (!(typeof value === "string" || Array.isArray(value))) {
            return false;
          }

          return value.includes(argument);

          break;
        }

        // array operators

        case "$some": {
          if (!Array.isArray(value)) {
            return false;
          }

          return value.some((element) =>
            this.findRules(element, argument, document)
          );

          break;
        }

        case "$every": {
          if (!Array.isArray(value)) {
            return false;
          }

          return value.every((element) =>
            this.findRules(element, argument, document)
          );

          break;
        }

        // other operators

        case "$length": {
          const length =
            value !== null && value !== undefined ? value.length : undefined;

          return this.findOperators(length, argument, document);

          break;
        }

        case "$exists": {
          return argument ? value !== undefined : value === undefined;

          break;
        }

        case "$rem": {
          const [divisor, operators] = argument;

          if (typeof value !== "number") {
            return false;
          }

          const remainder = value % divisor;

          return this.findOperators(remainder, operators, document);

          break;
        }

        case "$regex": {
          const regex = /^\/(.*)\/([a-z]*)$/;

          const match = argument.match(regex);

          const [pattern, flags] = match.slice(1, 3);

          const regExp = new RegExp(pattern, flags);

          return regExp.test(value);

          break;
        }
      }
    });
  }

  findValue(target, document, key) {
    const split = this.split(key);

    let value = key.startsWith("~") ? document : target;

    for (const k of split) {
      value = value !== null ? value[k] : undefined;

      if (value === undefined) {
        break;
      }
    }

    return value;
  }

  apply(document) {
    const { update } = this.params;

    const tmpDocument = this.applyRules(document, update);

    if (
      !(
        tmpDocument !== null &&
        typeof tmpDocument === "object" &&
        !Array.isArray(tmpDocument)
      )
    ) {
      return document;
    }

    return tmpDocument;
  }

  applyRules(target, rules, document = null) {
    let clone = this.clone(target);

    if (document === null) {
      document = clone;
    }

    loop: for (const key in rules) {
      const operators = rules[key];

      switch (key) {
        case "$this": {
          clone = this.applyOperators(clone, operators, clone, document);

          break;
        }

        default: {
          const split = this.split(key);

          let value = clone;

          // if value is not array or object, next rule

          if (!(value !== null && typeof value === "object")) {
            continue loop;
          }

          for (let i = 0; i < split.length - 1; i++) {
            const k = split[i];

            // since value[k] will become value: if value[k] is not array or object, next rule

            if (!(value[k] !== null && typeof value[k] === "object")) {
              continue loop;
            }

            value[k] = this.clone(value[k]);

            value = value[k];
          }

          // value is array or object

          const k = split[split.length - 1];

          value[k] = this.applyOperators(value[k], operators, clone, document);

          break;
        }
      }
    }

    return clone;
  }

  applyOperators(value, operators, target, document) {
    // cloning is necessary for some operators because `$this` will assign the value returned to `clone` in `applyRules`

    const keys = Object.keys(operators);

    return keys.reduce((value, key) => {
      const argument = operators[key];

      switch (key) {
        // set operators

        case "$set": {
          return this.clone(argument);

          break;
        }

        // unset operators

        case "$unset": {
          return undefined;

          break;
        }

        case "$$unset": {
          if (value === null) {
            return undefined;
          }

          return value;

          break;
        }

        // property operator

        case "$prop": {
          const tmpValue = this.findValue(target, document, argument);

          if (tmpValue === undefined) {
            return null;
          }

          return this.clone(tmpValue);

          break;
        }

        // conditional operator

        case "$cond": {
          const [rules, trueOperators, falseOperators] = argument;

          const boolean = this.findRules(target, rules, document);

          let tmpValue = value;

          if (boolean) {
            tmpValue = this.applyOperators(
              value,
              trueOperators,
              target,
              document
            );
          } else {
            if (falseOperators !== undefined) {
              tmpValue = this.applyOperators(
                value,
                falseOperators,
                target,
                document
              );
            }
          }

          if (tmpValue === undefined) {
            return null;
          }

          return tmpValue;

          break;
        }

        // arithmetic operators

        case "$inc": {
          if (typeof value !== "number") {
            return value;
          }

          return value + argument;

          break;
        }

        case "$dec": {
          if (typeof value !== "number") {
            return value;
          }

          return value - argument;

          break;
        }

        case "$mul": {
          if (typeof value !== "number") {
            return value;
          }

          return value * argument;

          break;
        }

        case "$div": {
          if (typeof value !== "number") {
            return value;
          }

          return value / argument;

          break;
        }

        case "$rem": {
          if (typeof value !== "number") {
            return value;
          }

          return value % argument;

          break;
        }

        case "$pow": {
          if (typeof value !== "number") {
            return value;
          }

          return value ** argument;

          break;
        }

        // number operators

        case "$max": {
          if (typeof value !== "number") {
            return value;
          }

          return Math.max(value, argument);

          break;
        }

        case "$min": {
          if (typeof value !== "number") {
            return value;
          }

          return Math.min(value, argument);

          break;
        }

        // string operators

        case "$split": {
          if (typeof value !== "string") {
            return value;
          }

          return value.split(argument);

          break;
        }

        case "$replace": {
          if (typeof value !== "string") {
            return value;
          }

          const [input, output] = argument;

          return value.replaceAll(input, output);

          break;
        }

        case "$concat": {
          const array = argument
            .map((element) => {
              if (element === null) {
                return value;
              }

              if (typeof element === "string") {
                return element;
              }

              return this.applyOperators(value, element, target, document);
            })
            .map((element) => {
              if (element === undefined) {
                return "";
              }

              if (typeof element === "string") {
                return element;
              }

              return JSON.stringify(element, (key, value) => {
                if (Array.isArray(value)) {
                  return value.filter((element) => element !== undefined);
                }

                return value;
              });
            });

          return "".concat(...array);

          break;
        }

        // array operators

        case "$push": {
          if (!Array.isArray(value)) {
            return value;
          }

          return [...value, argument];

          break;
        }

        case "$unshift": {
          if (!Array.isArray(value)) {
            return value;
          }

          return [argument, ...value];

          break;
        }

        case "$pop": {
          if (!Array.isArray(value)) {
            return value;
          }

          return value.slice(0, -1);

          break;
        }

        case "$shift": {
          if (!Array.isArray(value)) {
            return value;
          }

          return value.slice(1);

          break;
        }

        case "$append": {
          if (!Array.isArray(value)) {
            return value;
          }

          return [...value, ...argument];

          break;
        }

        case "$prepend": {
          if (!Array.isArray(value)) {
            return value;
          }

          return [...argument, ...value];

          break;
        }

        case "$map": {
          if (!Array.isArray(value)) {
            return value;
          }

          return value.map((element) =>
            this.applyRules(element, argument, document)
          );

          break;
        }

        case "$filter": {
          if (!Array.isArray(value)) {
            return value;
          }

          return value.filter((element) =>
            this.findRules(element, argument, document)
          );

          break;
        }

        case "$remove": {
          if (!Array.isArray(value)) {
            return value;
          }

          return value.filter((element) => element !== argument);

          break;
        }

        case "$unique": {
          if (!Array.isArray(value)) {
            return value;
          }

          return value.filter((element, i) => value.indexOf(element) === i);

          break;
        }

        case "$join": {
          if (!Array.isArray(value)) {
            return value;
          }

          return value.join(argument);

          break;
        }

        // timestamp operators

        case "$timestamp": {
          let input = null;

          if (argument !== null) {
            switch (typeof argument) {
              case "string":
              case "number": {
                input = argument;

                break;
              }

              case "object": {
                input = this.applyOperators(value, argument, document);

                break;
              }
            }
          }

          let date = null;

          switch (typeof input) {
            case "string": {
              date = new Date(input);

              if (isNaN(date.getTime())) {
                date = null;
              }

              break;
            }

            case "number": {
              date = new Date(input);

              break;
            }

            case "object": {
              if (input === null) {
                date = new Date();
              }

              break;
            }
          }

          if (date === null) {
            return null;
          }

          return date.getTime();

          break;
        }

        // multitype operators

        case "$length": {
          const length =
            value !== null && value !== undefined ? value.length : undefined;

          if (length === undefined) {
            return null;
          }

          return length;

          break;
        }

        case "$at": {
          if (!(typeof value === "string" || Array.isArray(value))) {
            return value;
          }

          const element = value.at(argument);

          if (element === undefined) {
            return null;
          }

          return this.clone(element);

          break;
        }

        case "$with": {
          if (!(typeof value === "string" || Array.isArray(value))) {
            return value;
          }

          const [index, element] = argument;

          try {
            if (typeof value === "string") {
              if (typeof element !== "string") {
                return value;
              }

              return value.split("").with(index, element).join("");
            } else {
              return value.with(index, element);
            }
          } catch (error) {
            return value;
          }

          break;
        }

        case "$slice": {
          if (!(typeof value === "string" || Array.isArray(value))) {
            return value;
          }

          const [start, end] = argument;

          return value.slice(start, end);

          break;
        }
      }
    }, value);
  }

  split(key) {
    const pattern = /(\[\d+\]|\w+)/g;

    const match = key.match(pattern);

    return match.map((string) => {
      if (string.startsWith("[") && string.endsWith("]")) {
        return parseInt(string.slice(1, -1), 10);
      }

      return string;
    });
  }

  clone(value) {
    if (Array.isArray(value)) {
      return [...value];
    }

    if (value !== null && typeof value === "object") {
      return { ...value };
    }

    return value;
  }

  sort(documents) {
    const { sort } = this.params;

    for (const key in sort) {
      const value = sort[key];

      documents.sort((a, b) => {
        const valueA = this.findValue(a, a, key);
        const valueB = this.findValue(b, b, key);

        return this.sortValues(valueA, valueB, value);
      });
    }
  }

  sortValues(a, b, order) {
    switch (order) {
      // ascending

      case 1: {
        if (a > b) {
          return 1;
        }

        if (a < b) {
          return -1;
        }

        break;
      }

      // descending

      case -1: {
        if (a < b) {
          return 1;
        }

        if (a > b) {
          return -1;
        }

        break;
      }
    }

    return 0;
  }

  isValid(key) {
    return /^(?:(?![\$\[\].]).)*$/.test(key);
  }

  encode(document) {
    const tmpDocument = this.parse(document);

    const maxDocumentSize = this.server.getMaxDocumentSize();

    const json = JSON.stringify(tmpDocument);

    const encode = this.encoder.encode(json);

    if (encode.length > maxDocumentSize) {
      throw new Error(`Max document size is ${maxDocumentSize} bytes.`);
    }

    return tmpDocument;
  }

  parse(value) {
    if (Array.isArray(value)) {
      return value
        .filter((tmpValue) => tmpValue !== undefined)
        .map((tmpValue) => this.parse(tmpValue));
    }

    if (value !== null && typeof value === "object") {
      const { id } = value;

      const tmpValue = {};

      // valid id: 24 character hex string

      tmpValue.id = ObjectId.test(id) ? id : ObjectId.generate();

      for (const key in value) {
        if (key === "id") {
          continue;
        }

        if (value[key] === undefined) {
          continue;
        }

        if (!this.isValid(key)) {
          throw new Error(`Property name "${key}" is not valid.`);
        }

        tmpValue[key] = this.parse(value[key]);
      }

      return tmpValue;
    }

    return value;
  }
}

module.exports = Query;
