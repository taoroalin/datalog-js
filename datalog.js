const indexGet1 = (index,key1) => {
  if (index[key1] === undefined) {
    index[key1] = {}
  }
  return index[key1]
}
const indexGet2 = (index,key1,key2) => {
  if (index[key1] === undefined) {
    index[key1] = {}
  }
  const level = index[key1]
  if (level[key2] === undefined) {
    level[key2] = []
  }
  return level[key2]
}
const indexHas2 = (index,key1,key2) => {
  return index[key1] && index[key1][key2]
}

class DQ {
  // negative numbers are entity ids
  static maxEntityId = -1;

  constructor(graphName,many,nextEntityId = DQ.maxEntityId,eav,aev,vae) {
    this.nextEntityId = nextEntityId
    this.many = many
    this.graphName = graphName
    this.aev = {}
    this.vae = {}
    if (eav && aev && vae) {
      this.eav = eav
      this.aev = aev
      this.vae = vae
    } else if (eav) {
      this.eav = eav
      for (let ke in eav) {
        const av = eav[ke]
        for (let ka in av) {
          if (this.aev[ka] === undefined) {
            this.aev[ka] = {}
          }
          const v = av[ka]
          this.aev[ka][ke] = v
          if (typeof v !== "object") {
            if (this.vae[v] === undefined) {
              this.vae[v] = {}
            }
            const ae = this.vae[v]
            if (ae[ka] === undefined)
              ae[ka] = []
            ae[ka].push(ke)
          } else if (v instanceof Array) {
            for (let sv of v) {
              if (this.vae[sv] === undefined) {
                this.vae[sv] = {}
              }
              const ae = this.vae[sv]
              if (ae[ka] === undefined)
                ae[ka] = []
              ae[ka].push(ke)
            }
          }
        }
      }
    } else {
      this.eav = {}
    }
  }

  newEntity() {
    this.nextEntityId -= 1
    return this.nextEntityId + 1
  }

  addDatom(entity,attribute,value) {
    this.nextEntityId = Math.min(this.nextEntityId,entity + 1)
    indexGet2(this.eav,entity,attribute).push(value)
    indexGet2(this.aev,attribute,entity).push(value)

    if (typeof value !== "object") {
      indexGet2(this.vae,value,attribute).push(entity)
    }
  }

  setDatom(entity,attribute,value) {
    this.nextEntityId = Math.min(this.nextEntityId,entity + 1)
    indexGet1(this.eav,entity)[attribute] = value
    indexGet1(this.aev,attribute)[entity] = value

    if (typeof value !== "object") {
      indexGet2(this.vae,value,attribute).push(entity)
    }
  }

  pull(entityId,includeId = false) {
    // Keep track of seen entities to capture recursive data structures
    const entityIdToObj = {}
    const pull = (entityId) => {
      const result = {}
      if (includeId) result.entityId = entityId
      entityIdToObj[entityId] = result
      const entity = indexGet1(this.eav,entityId)
      for (let attribute in entity) {
        const value = entity[attribute]
        if (attribute === ":block/refs" || attribute === "refs") {
          result[attribute] = value.map(uid => ({ ":block/uid": uid }))
        } else if (attribute === ":create/user" || attribute === ":edit/user") {
          result[attribute] = { ":user/uid": value }
        } else if (this.many[attribute]) {
          result[attribute] = []
          for (let v of value) {
            if (typeof v === "number" && v <= DQ.maxEntityId) {
              if (entityIdToObj[v])
                result[attribute].push(entityIdToObj[v])
              else result[attribute].push(pull(v))
            } else result[attribute].push(v)
          }
        } else {
          if (typeof value === "number" && value <= DQ.maxEntityId) {
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
        } else if (value instanceof Array) {
          if (attribute === ":block/refs") {
            for (let x of value) {
              this.addDatom(objId,attribute,x[":block/uid"])
            }
          } else if (attribute === "refs") {
            for (let x of value) {
              this.addDatom(objId,attribute,x["uid"])
            }
          } else {
            for (let setElement of value) {
              if (typeof setElement !== "object" || setElement instanceof Array) {
                this.addDatom(objId,attribute,setElement)
              } else {
                let elId = this.newEntity()
                this.addDatom(objId,attribute,elId)
                push(setElement,elId)
              }
            }
          }
        } else if (attribute === ":create/user" || attribute === ":edit/user") {
          this.setDatom(objId,attribute,value[":user/uid"])
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