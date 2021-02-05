const makeSet = () => {
  const result = new Set();
  result.isDatabaseMany = true;
  return result;
};

const makeArray = () => [];
const makeObject = () => ({});

class Index {
  constructor() { }
  get1(key1) {
    if (this[key1] === undefined) {
      this[key1] = {};
    }
    return this[key1];
  }
  get2(key1, key2) {
    if (this[key1] === undefined) {
      this[key1] = {};
    }
    const level = this[key1];
    if (level[key2] === undefined || level[key2].isDatabaseMany !== true) {
      level[key2] = makeSet();
    }
    return level[key2];
  }
  has2(key1, key2) {
    return this[key1] && this[key1][key2];
  }
}

class DQ {
  // numbers over one trillion are entity ids, numbers lower are regular numbers.
  static minEntityId = 1000000000;

  constructor(schema, ednSchema) { // schema is a fugly word, especially in this font :(
    // schema: [[attributeString, ...("fullText" | ...)]]
    this.eav = new Index();
    this.aev = new Index();
    this.vae = new Index();
    this.listeners = new Index();
    this.nextEntityId = DQ.minEntityId;
    this.ednSchema = ednSchema;

    this.fullTextAttributes = {};
    this.fullTextIndex = {};

    for (let scheme in schema) { // this is not correct pluralization
      if (scheme[1] === "fullText") {
        this.fullTextAttributes[scheme[0]] = true;
      }
    }
  }

  newEntity() {
    this.nextEntityId++;
    return this.nextEntityId - 1;
  }

  addDatom(entity, attribute, value) {
    this.nextEntityId = Math.max(this.nextEntityId, entity + 1);
    this.eav.get2(entity, attribute).add(value);
    this.aev.get2(attribute, entity).add(value);

    if (typeof value !== "object") {
      this.vae.get2(value, attribute).add(entity);
    }
    if (this.listeners.has2(entity, attribute)) {
      for (let callback of this.listeners.get2(entity, attribute)) {
        callback(value);
      }
    }
  }

  setDatom(entity, attribute, value) {
    this.nextEntityId = Math.max(this.nextEntityId, entity + 1);
    this.eav.get1(entity)[attribute] = value;
    this.aev.get1(attribute)[entity] = value;

    if (typeof value !== "object") {
      this.vae.get2(value, attribute).add(entity);
    }
    if (this.listeners.has2(entity, attribute)) {
      for (let callback of this.listeners.get2(entity, attribute)) {
        callback(value);
      }
    }
  }

  addListener(entity, attribute, callback) {
    this.listeners.get2(entity, attribute).add(callback);
  }

  // TODO this is totally fake, needs to be actually written
  query(firstStatement, ...statements) {
    let matches = this.vae[firstStatement[2]][firstStatement[1]];
    return matches;
  }

  pull(entityId) {
    // Keep track of seen entities to avoid pulling infinite loop
    const entityIdToObj = new Map();
    const pull = (entityId) => {
      const result = { entityId: entityId };
      entityIdToObj.set(entityId, result);
      const entity = this.eav.get1(entityId);
      for (let attribute in entity) {
        const val = entity[attribute];
        if (val.isDatabaseMany) {
          result[attribute] = new Set();
          for (let v of val) {
            if (
              typeof v === "number" &&
              attribute !== "entityId" &&
              v >= DQ.minEntityId
            ) {
              if (entityIdToObj.has(v))
                result[attribute].add(entityIdToObj.get(v));
              else result[attribute].add(pull(v));
            } else result[attribute].add(v);
          }
        } else {
          if (
            typeof val === "number" &&
            attribute !== "entityId" &&
            val >= DQ.minEntityId
          ) {
            if (entityIdToObj.has(val))
              result[attribute] = entityIdToObj.get(val);
            else result[attribute] = pull(val);
          } else result[attribute] = val;
        }
      }
      return result;
    };
    return pull(entityId);
  }

  push(obj) {
    if (obj.entityId === undefined) {
      obj.entityId = this.newEntity();
    }
    for (let attribute in obj) {
      const value = obj[attribute];
      if (typeof value !== "object") {
        this.setDatom(obj.entityId, attribute, value);
      } else if (value instanceof Set) {
        for (let setElement of value) {
          if (typeof setElement !== "object") {
            this.addDatom(obj.entityId, attribute, setElement);
          } else if (setElement instanceof Set || setElement instanceof Array) {
            throw new Error(`can't push nested arrays/sets`);
          } else if (setElement.entityId !== undefined) {
            this.addDatom(obj.entityId, attribute, setElement.entityId);
          } else {
            if (setElement.entityId === undefined) {
              setElement.entityId = this.newEntity();
            }
            this.addDatom(obj.entityId, attribute, setElement.entityId);
            this.push(setElement);
          }
        }
      } else if (value instanceof Array) {
        throw new Error(`no know how do array`);
      } else if (value.entityId !== undefined) {
        this.addDatom(obj.entityId, attribute, value.entityId);
      } else {
        if (value.entityId === undefined) {
          value.entityId = this.newEntity();
        }
        this.setDatom(obj.entityId, attribute, value.entityId);
        this.push(value);
      }
    }
    return obj.entityId;
  }
}

const excludedWords = new Set([
  "a",
  "also",
  "and",
  "as",
  "at",
  "be",
  "but",
  "by",
  "can",
  "come",
  "could",
  "do",
  "even",
  "for",
  "from",
  "get",
  "go",
  "have",
  "he",
  "her",
  "here",
  "him",
  "his",
  "how",
  "I",
  "if",
  "in",
  "into",
  "it",
  "its",
  "just",
  "know",
  "like",
  "look",
  "me",
  "more",
  "my",
  "new",
  "no",
  "not",
  "now",
  "of",
  "on",
  "one",
  "only",
  "or",
  "other",
  "our",
  "out",
  "say",
  "see",
  "she",
  "so",
  "some",
  "take",
  "tell",
  "than",
  "that",
  "the",
  "then",
  "there",
  "these",
  "they",
  "thing",
  "this",
  "those",
  "to",
  "very",
  "want",
  "way",
  "well",
  "who",
  "with",
  "you",
]);