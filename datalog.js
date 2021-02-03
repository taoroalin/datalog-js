const makeSet = () => {
  const result = new Set();
  result.isDatabaseMany = true;
  return result;
};

const makeArray = () => [];
const makeObject = () => ({});

class Index {
  constructor() {}
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

  static $ = "?";
  static $1 = "?1";
  static $2 = "?2";
  static $3 = "?3";
  static $4 = "?4";
  static $a = "?a";
  static _ = "_";

  constructor() {
    this.eav = new Index();
    this.aev = new Index();
    this.vae = new Index();
    this.listeners = new Index();
    this.nextEntityId = DQ.minEntityId;
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

  query(firstStatement, ...statements) {
    let matches = this.vae[firstStatement[2]][firstStatement[1]];
    return matches;
  }

  queryPull(firstStatement, ...statements) {
    const queryResult = this.query(firstStatement, ...statements);
    if (queryResult.isDatabaseMany) {
      const result = [];
      for (let id of queryResult) {
        result.push(this.pull(id));
      }
      return result;
    } else {
      return this.pull(queryResult);
    }
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
