class Index {
  constructor() { }
  get1(key1) {
    if (this[key1] === undefined) {
      this[key1] = {}
    }
    return this[key1]
  }
  get2(key1,key2) {
    if (this[key1] === undefined) {
      this[key1] = {}
    }
    const level = this[key1]
    if (level[key2] === undefined) {
      level[key2] = []
    }
    return level[key2]
  }
  has2(key1,key2) {
    return this[key1] && this[key1][key2]
  }
}

class DQ {
  // numbers over one trillion are entity ids, numbers lower are regular numbers.
  static minEntityId = 10000000000000;

  constructor(name,schema) { // schema is a fugly word, especially in this font :(
    // schema: [[attributeString, ...("fullText" | ...)]]
    this.eav = new Index()
    this.aev = new Index()
    this.vae = new Index()
    this.nextEntityId = DQ.minEntityId
    this.isMany = schema && schema.many
    this.graphName = name
  }

  newEntity() {
    this.nextEntityId++
    return this.nextEntityId - 1
  }

  addDatom(entity,attribute,value) {
    this.nextEntityId = Math.max(this.nextEntityId,entity + 1)
    this.eav.get2(entity,attribute).push(value)
    this.aev.get2(attribute,entity).push(value)

    if (typeof value !== "object") {
      this.vae.get2(value,attribute).push(entity)
    }
  }

  setDatom(entity,attribute,value) {
    this.nextEntityId = Math.max(this.nextEntityId,entity + 1)
    this.eav.get1(entity)[attribute] = value
    this.aev.get1(attribute)[entity] = value

    if (typeof value !== "object") {
      this.vae.get2(value,attribute).push(entity)
    }
  }

  pull(entityId,includeId = false) {
    // Keep track of seen entities to capture recursive data structures
    const entityIdToObj = {}
    const pull = (entityId) => {
      const result = {}
      if (includeId) result.entityId = entityId
      entityIdToObj[entityId] = result
      const entity = this.eav.get1(entityId)
      for (let attribute in entity) {
        const value = entity[attribute]
        if (this.isMany[attribute]) {
          result[attribute] = []
          for (let v of value) {
            if (typeof v === "number" && v >= DQ.minEntityId) {
              if (entityIdToObj[v])
                result[attribute].push(entityIdToObj[v])
              else result[attribute].push(pull(v))
            } else result[attribute].push(v)
          }
        } else {
          if (typeof value === "number" && value >= DQ.minEntityId) {
            if (entityIdToObj[value])
              result[attribute] = entityIdToObj[value]
            else result[attribute] = pull(value)
          } else result[attribute] = value
        }
      }
      return result
    }
    return pull(entityId)
  }

  push(obj,objId) {
    if (objId === undefined) objId = this.newEntity()
    const push = (obj,objId) => {
      for (let attribute in obj) {
        const value = obj[attribute]
        if (typeof value !== "object") {
          this.setDatom(objId,attribute,value)
        } else if (value instanceof Array || value instanceof Set) {
          if (attribute === ":block/refs") {
            for (let x of Object.values(value)) {
              this.addDatom(objId,":block/refs",x[":block/uid"])
            }
          } else {
            for (let setElement of value) {
              if (typeof setElement !== "object" ||
                setElement instanceof Set ||
                setElement instanceof Array) {
                this.addDatom(objId,attribute,setElement)
              } else {
                let elId = this.newEntity()
                this.addDatom(objId,attribute,elId)
                push(setElement,elId)
              }
            }
          }
        } else {
          let valId = this.newEntity()
          this.setDatom(objId,attribute,valId)
          push(value,valId)
        }
      }
    }
    push(obj,objId)
    return objId
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
])