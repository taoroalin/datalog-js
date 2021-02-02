const makeSet = () => {
  const result = new Set();
  result.isDatabaseMany = true;
  return result;
};

const makeArray = () => [];
const makeObject = () => ({});
// numbers over one trillion are entity ids, numbers lower are regular numbers.
const minEntityId = 1000000000000;

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
}

class DQ {
  constructor() {
    this.eav = new Index();
    this.aev = new Index();
    this.vae = new Index();
    this.nextEntityId = minEntityId;
  }
  newEntity() {
    this.nextEntityId++;
    return this.nextEntityId - 1;
  }
  addDatom(entity, attribute, value) {
    this.eav.get2(entity, attribute).add(value);
    this.aev.get2(attribute, entity).add(value);

    if (typeof value !== "object") {
      this.vae.get2(value, attribute).add(entity);
    }
  }
  setDatom(entity, attribute, value) {
    this.eav.get1(entity)[attribute] = value;
    this.aev.get1(attribute)[entity] = value;

    if (typeof value !== "object") {
      this.vae.get1(value)[attribute] = entity;
    }
  }

  query;

  pull(entityId) {
    // Keep track of seen entities to avoid pulling infinite loop
    const entityIdToObj = new Map();
    const pull = (entityId) => {
      const result = {};
      entityIdToObj.set(entityId, result);
      const entity = this.eav.get1(entityId);
      for (let attribute in entity) {
        const val = entity[attribute];
        if (val.isDatabaseMany) {
          result[attribute] = new Set();
          for (let v of val) {
            if (typeof v === "number" && v >= minEntityId) {
              if (entityIdToObj.has(v)) {
                result[attribute].add(entityIdToObj.get(v));
              } else {
                result[attribute].add(pull(v));
              }
            } else {
              result[attribute].add(v);
            }
          }
        } else {
          if (typeof val === "number" && val >= minEntityId) {
            if (entityIdToObj.has(val)) {
              result[attribute] = entityIdToObj.get(val);
            } else {
              result[attribute] = pull(val);
            }
          } else {
            result[attribute] = val;
          }
        }
      }
      return result;
    };
    return pull(entityId);
  }

  push(obj, entityId) {
    if (entityId === undefined) {
      entityId = this.newEntity();
    }
    // map from object *by reference* to entity id
    const entityObjToId = new Map();
    entityObjToId.set(obj, entityId);
    const push = (obj, entityId) => {
      for (let attribute in obj) {
        const value = obj[attribute];
        if (typeof value !== "object") {
          this.setDatom(entityId, attribute, value);
        } else if (value instanceof Set) {
          for (let setElement of value) {
            if (typeof setElement !== "object") {
              this.addDatom(entityId, attribute, setElement);
            } else if (
              setElement instanceof Set ||
              setElement instanceof Array
            ) {
              throw new Error(`can't push nested arrays/sets`);
            } else if (entityObjToId.has(setElement)) {
              this.addDatom(entityId, attribute, entityObjToId.get(setElement));
            } else {
              const childEntityId = this.newEntity();
              this.addDatom(entityId, attribute, childEntityId);
              entityObjToId.set(setElement, childEntityId);
              push(setElement, childEntityId);
            }
          }
        } else if (value instanceof Array) {
          throw new Error(`no know how do array`);
        } else if (entityObjToId.has(value)) {
          this.setDatom(entityId, attribute, entityObjToId.get(value));
        } else {
          const childEntityId = this.newEntity();
          this.setDatom(entityId, attribute, childEntityId);
          entityObjToId.set(value, childEntityId);
          push(value, childEntityId);
        }
      }
    };
    push(obj, entityId);
    return entityId;
  }
}
