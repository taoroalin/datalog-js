const database = new DQ();
// const entity1 = database.newEntity();
// const entity2 = database.newEntity();
// database.setDatom(entity1, "parent", entity2);
// database.setDatom(entity1, "name", "yoyoyo");
// database.setDatom(entity2, "name", "stanislav");

// console.log(database.pull(entity1));

const exampleToPush = {
  people: new Set([
    { name: "danny", age: 20 },
    { name: "oliver", age: 10 },
  ]),
  maxPeople: 10,
};
for (let zed of exampleToPush.people) {
  zed.group = exampleToPush;
}
const pushedId = database.push(exampleToPush);
console.log(database);

database.setDatom(pushedId, "fired", "totally");

function testPerformance() {
  const stime = performance.now();
  for (let i = 0; i < 10000; i++) {
    database.push(exampleToPush);
    database.pull(pushedId);
  }
  console.log(database);
  console.log(`took ${performance.now() - stime}`);
}

const testRoamJSON = async () => {
  const manyAttributes = ["node/subpages", "vc/blocks", "edit/seen-by", "attrs/lookup", "node/windows", "node/sections", "harc/v", "block/refs", "harc/a", "block/children", "create/seen-by", "node/links", "query/results", "harc/e", "block/parents"];
  const jsonResponse = await fetch("../test-data/graphminer.json");
  const jsonGraph = await jsonResponse.json();
  console.log(jsonGraph);
  const db = new DQ({ many: manyAttributes });
  const pushtime = performance.now();
  for (let page of jsonGraph) db.push(page);
  console.log(`push took ${performance.now() - pushtime}`)
  console.log(db.aev);
  const pullTime = performance.now();
  const remake = db.pull(DQ.minEntityId);
  console.log(`pull took ${performance.now() - pullTime}`)
  console.log(remake);
}

testPerformance();
testRoamJSON();

// // this is a query in Clojure style. It doesn't look right in JS
// const stanislav = Database.query([
//   ["?", "parent", "?2"],
//   ["?2", "name", "stanislav"],
// ]);

// Using constants defined in Database in place of unbound symbols looks nice
// const stanislav = Database.query([
//   [DQ.RESULT, "parent", DQ.VAR1],
//   [DQ.VAR1, "name", "stanislav"],
// ]);
