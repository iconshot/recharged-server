class Validator {
  static validate({
    create = null,
    find = null,
    sort = null,
    limit = null,
    skip = 0,
    update = null,
  }) {
    if (!(create === null || Array.isArray(create))) {
      throw new Error('Param "create" must be null or an array of documents.');
    }

    if (!(typeof find === "object" && !Array.isArray(find))) {
      throw new Error('Param "find" must be null or a rule object.');
    }

    if (!(typeof sort === "object" && !Array.isArray(sort))) {
      throw new Error('Param "sort" must be null or a sort object.');
    }

    if (!(limit === null || (typeof limit === "number" && limit >= 0))) {
      throw new Error('Param "limit" must be null or a positive number.');
    }

    if (!(typeof skip === "number" && skip >= 0)) {
      throw new Error('Param "skip" must be a positive number.');
    }

    if (!(typeof update === "object" && !Array.isArray(update))) {
      throw new Error('Param "update" must be null or a rule object.');
    }

    this.create(create);
    this.find(find);
    this.apply(update);
    this.sort(sort);

    return { create, find, sort, limit, skip, update };
  }

  static create(create) {
    if (create === null) {
      return;
    }

    for (const document of create) {
      if (!this.isObject(document)) {
        throw new Error(
          'Param "create" must be null or an array of documents.'
        );
      }
    }
  }

  static find(find) {
    if (find === null) {
      return;
    }

    this.findRules(find);
  }

  static findRules(rules) {
    for (const key in rules) {
      switch (key) {
        case "$and": {
          const array = rules[key];

          if (!Array.isArray(array)) {
            throw new Error(
              'Find operator "$and" expects an array of rule objects.'
            );
          }

          for (const rules of array) {
            if (!this.isObject(rules)) {
              throw new Error(
                'Find operator "$and" expects an array of rule objects.'
              );
            }
          }

          for (const rules of array) {
            this.findRules(rules);
          }

          break;
        }

        case "$nand": {
          const array = rules[key];

          if (!Array.isArray(array)) {
            throw new Error(
              'Find operator "$nand" expects an array of rule objects.'
            );
          }

          for (const rules of array) {
            if (!this.isObject(rules)) {
              throw new Error(
                'Find operator "$nand" expects an array of rule objects.'
              );
            }
          }

          for (const rules of array) {
            this.findRules(rules);
          }

          break;
        }

        case "$or": {
          const array = rules[key];

          if (!Array.isArray(array)) {
            throw new Error(
              'Find operator "$or" expects an array of rule objects.'
            );
          }

          for (const rules of array) {
            if (!this.isObject(rules)) {
              throw new Error(
                'Find operator "$or" expects an array of rule objects.'
              );
            }
          }

          for (const rules of array) {
            this.findRules(rules);
          }

          break;
        }

        case "$nor": {
          const array = rules[key];

          if (!Array.isArray(array)) {
            throw new Error(
              'Find operator "$nor" expects an array of rule objects.'
            );
          }

          for (const rules of array) {
            if (!this.isObject(rules)) {
              throw new Error(
                'Find operator "$nor" expects an array of rule objects.'
              );
            }
          }

          for (const rules of array) {
            this.findRules(rules);
          }

          break;
        }

        case "$this": {
          const operators = rules[key];

          if (!this.isObject(operators)) {
            throw new Error(
              'Find operator "$this" expects an operator object.'
            );
          }

          this.findOperators(operators);

          break;
        }

        default: {
          const operators = rules[key];

          if (!this.isObject(operators)) {
            throw new Error(`Find rule "${key}" expects an operator object.`);
          }

          this.findOperators(operators);

          break;
        }
      }
    }
  }

  static findOperators(operators) {
    for (const key in operators) {
      const argument = operators[key];

      switch (key) {
        case "$eq":
        case "$ne":
        case "$gt":
        case "$lt":
        case "$gte":
        case "$lte": {
          break;
        }

        case "$not": {
          if (!this.isObject(argument)) {
            throw new Error('Find operator "$not" expects an operator object.');
          }

          this.findOperators(argument);

          break;
        }

        case "$in": {
          if (!Array.isArray(argument)) {
            throw new Error('Find operator "$in" expects an array.');
          }

          break;
        }

        case "$nin": {
          if (!Array.isArray(argument)) {
            throw new Error('Find operator "$nin" expects an array.');
          }

          break;
        }

        case "$includes": {
          break;
        }

        case "$some": {
          if (!this.isObject(argument)) {
            throw new Error('Find operator "$some" expects a rule object.');
          }

          this.findRules(argument);

          break;
        }

        case "$every": {
          if (!this.isObject(argument)) {
            throw new Error('Find operator "$every" expects a rule object.');
          }

          this.findRules(argument);

          break;
        }

        case "$length": {
          if (!this.isObject(argument)) {
            throw new Error(
              'Find operator "$length" expects an operator object.'
            );
          }

          this.findOperators(argument);

          break;
        }

        case "$exists": {
          if (typeof argument !== "boolean") {
            throw new Error('Find operator "$exists" expects a boolean.');
          }

          break;
        }

        case "$rem": {
          if (!Array.isArray(argument)) {
            throw new Error(
              'Find operator "$rem" expects two arguments: divisor and rules.'
            );
          }

          if (argument.length !== 2) {
            throw new Error(
              'Find operator "$rem" expects two arguments: divisor and rules.'
            );
          }

          const [divisor, operators] = argument;

          if (typeof divisor !== "number") {
            throw new Error(
              'Find operator "$rem" expects its first argument to be a number.'
            );
          }

          if (!this.isObject(operators)) {
            throw new Error(
              'Find operator "$rem" expects its second argument to be an operator object.'
            );
          }

          this.findOperators(operators);

          break;
        }

        case "$regex": {
          if (typeof argument !== "string") {
            throw new Error(
              'Find operator "$regex" expects a valid regex string.'
            );
          }

          const regex = /^\/(.*)\/([a-z]*)$/;

          const match = argument.match(regex);

          if (match === null) {
            throw new Error(
              'Find operator "$regex" expects a valid regex string.'
            );
          }

          const [pattern, flags] = match.slice(1, 3);

          try {
            new RegExp(pattern, flags);
          } catch (error) {
            throw new Error(
              'Find operator "$regex" expects a valid regex string.'
            );
          }

          break;
        }

        default: {
          throw new Error(`"${key}" is not a valid find operator.`);

          break;
        }
      }
    }
  }

  static apply(update) {
    if (update === null) {
      return;
    }

    this.applyRules(update);
  }

  static applyRules(rules) {
    for (const key in rules) {
      switch (key) {
        case "$this": {
          const operators = rules[key];

          if (!this.isObject(operators)) {
            throw new Error(
              'Update operator "$this" expects an operator object.'
            );
          }

          this.applyOperators(operators);

          break;
        }

        default: {
          const operators = rules[key];

          if (!this.isObject(operators)) {
            throw new Error(`Update rule "${key}" expects an operator object.`);
          }

          this.applyOperators(operators);

          break;
        }
      }
    }
  }

  static applyOperators(operators) {
    for (const key in operators) {
      const argument = operators[key];

      switch (key) {
        case "$set": {
          break;
        }

        case "$unset":
        case "$$unset": {
          if (argument !== null) {
            throw new Error(`Update operator "${key}" expects null.`);
          }

          break;
        }

        case "$prop": {
          if (typeof argument !== "string") {
            throw new Error('Update operator "$prop" expects a string.');
          }

          break;
        }

        case "$cond": {
          if (!Array.isArray(argument)) {
            throw new Error(
              'Update operator "$cond" expects two to three arguments: condition rule object, "true" operator object, "false" operator object (optional).'
            );
          }

          if (argument.length !== 2 && argument.length !== 3) {
            throw new Error(
              'Update operator "$cond" expects two to three arguments: condition rule object, "true" operator object, "false" operator object (optional).'
            );
          }

          const [rules, trueOperators, falseOperators] = argument;

          if (!this.isObject(rules)) {
            throw new Error(
              'Update operator "$cond" expects its first argument to be a rule object.'
            );
          }

          this.findRules(rules);

          if (!this.isObject(trueOperators)) {
            throw new Error(
              'Update operator "$cond" expects its second argument to be an operator object.'
            );
          }

          this.applyOperators(trueOperators);

          if (
            !(this.isObject(falseOperators) || falseOperators === undefined)
          ) {
            throw new Error(
              'Update operator "$cond" expects its third argument to be an operator object (optional).'
            );
          }

          if (falseOperators !== undefined) {
            this.applyOperators(falseOperators);
          }

          break;
        }

        case "$inc":
        case "$dec":
        case "$mul":
        case "$div":
        case "$rem":
        case "$pow":
        case "$max":
        case "$min": {
          if (typeof argument !== "number") {
            throw new Error(`Update operator "${key}" expects a number.`);
          }

          break;
        }

        case "$split": {
          if (typeof argument !== "string") {
            throw new Error('Update operator "$split" expects a string.');
          }

          break;
        }

        case "$replace": {
          if (!Array.isArray(argument)) {
            throw new Error(
              'Update operator "$replace" expects two arguments: input and output.'
            );
          }

          if (argument.length !== 2) {
            throw new Error(
              'Update operator "$replace" expects two arguments: input and output.'
            );
          }

          const [input, output] = argument;

          if (typeof input !== "string") {
            throw new Error(
              'Update operator "$replace" expects its first argument to be string.'
            );
          }

          if (typeof output !== "string") {
            throw new Error(
              'Update operator "$replace" expects its second argument to be string.'
            );
          }

          break;
        }

        case "$concat": {
          if (!Array.isArray(argument)) {
            throw new Error(
              'Update operator "$concat" expects an array of strings or operator objects.'
            );
          }

          for (const element of argument) {
            if (
              !(
                element === null ||
                typeof element === "string" ||
                this.isObject(element)
              )
            ) {
              throw new Error(
                'Update operator "$concat" expects an array of nulls, strings or operator objects.'
              );
            }
          }

          for (const element of argument) {
            if (this.isObject(element)) {
              this.applyOperators(element);
            }
          }

          break;
        }

        case "$push":
        case "$unshift": {
          break;
        }

        case "$pop":
        case "$shift": {
          if (argument !== null) {
            throw new Error(`Update operator "${key}" expects null.`);
          }

          break;
        }

        case "$append":
        case "$prepend": {
          if (!Array.isArray(argument)) {
            throw new Error(`Update operator "${key}" expects an array.`);
          }

          break;
        }

        case "$map": {
          if (!this.isObject(argument)) {
            throw new Error('Update operator "$map" expects a rule object.');
          }

          this.applyRules(argument);

          break;
        }

        case "$filter": {
          if (!this.isObject(argument)) {
            throw new Error('Update operator "$filter" expects a rule object.');
          }

          this.findRules(argument);

          break;
        }

        case "$unique": {
          if (argument !== null) {
            throw new Error('Update operator "$unique" expects null.');
          }

          break;
        }

        case "$remove": {
          break;
        }

        case "$join": {
          if (typeof argument !== "string") {
            throw new Error('Update operator "$join" expects a string.');
          }

          break;
        }

        case "$timestamp": {
          switch (typeof argument) {
            case "string":
            case "number": {
              break;
            }

            case "object": {
              if (Array.isArray(argument)) {
                throw new Error(
                  `Update operator "${key}" expects null, number, string or operator object.`
                );
              }

              if (this.isObject(argument)) {
                this.applyOperators(argument);
              }

              break;
            }

            default: {
              throw new Error(
                `Update operator "${key}" expects null, number, string or operator object.`
              );

              break;
            }
          }

          break;
        }

        case "$length": {
          if (argument !== null) {
            throw new Error('Update operator "$length" expects null.');
          }

          break;
        }

        case "$at": {
          if (typeof argument !== "number") {
            throw new Error('Update operator "$at" expects a number.');
          }

          break;
        }

        case "$with": {
          if (!Array.isArray(argument)) {
            throw new Error(
              'Update operator "$with" expects two arguments: index and element.'
            );
          }

          if (argument.length !== 2) {
            throw new Error(
              'Update operator "$with" expects two arguments: index and element.'
            );
          }

          const [index] = argument;

          if (typeof index !== "number") {
            throw new Error(
              'Update operator "$with" expects its first argument to be a number.'
            );
          }

          break;
        }

        case "$slice": {
          if (!Array.isArray(argument)) {
            throw new Error(
              'Update operator "$slice" expects one or two numbers.'
            );
          }

          if (argument.length !== 1 && argument.length !== 2) {
            throw new Error(
              'Update operator "$slice" expects one or two numbers.'
            );
          }

          const [start, end] = argument;

          if (!(typeof start === "number")) {
            throw new Error(
              'Update operator "$slice" expects its first argument to be a number.'
            );
          }

          if (!(typeof end === "number" || end === undefined)) {
            throw new Error(
              'Update operator "$slice" expects its second argument to be a number (optional).'
            );
          }

          break;
        }

        default: {
          throw new Error(`"${key}" is not a valid update operator.`);

          break;
        }
      }
    }
  }

  static sort(sort) {
    if (sort === null) {
      return;
    }

    this.sortRules(sort);
  }

  static sortRules(rules) {
    for (const key in rules) {
      const value = rules[key];

      if (!(value === 1 || value === -1 || value === 0)) {
        throw new Error(`Sort rule "${key}" expects 1, -1 or 0.`);
      }
    }
  }

  static isObject(object) {
    return (
      object !== null && typeof object === "object" && !Array.isArray(object)
    );
  }
}

module.exports = Validator;
