import tingodb from "tingodb";
var Db = tingodb().Db;
import { promisify } from "util";
// import { equal } from "assert";

// let collection = null;

export function getLocalDatabase(path = "./data/tingo", options = {}) {
  let db = new Db(path, options);
  return db;
}

try {
  let db = new Db("./data/tingo", {});
  let collection = db.collection("trial");
  // collection.createIndex({ createdAt: 1 }, { expireAfterSeconds: 60 });
  // collection.insert(
  //   [{ hello: "to_delete", createdAt: new Date() }],
  //   { w: 1 },
  //   async function (err, result) {
  //     console.log({ result });

  //     // Fetch the document
  //     let item = await promisify((callback) =>
  //       collection.findOne({ hello: "to_delete" }, callback)
  //     )();
  //     console.log({ item });
  //   }
  // );
  let item = await promisify((callback) => {
    let reqDate = new Date();
    reqDate.setSeconds(reqDate.getSeconds() - 30);
    console.log({ collection: collection.aggregate });
    return collection
      .aggregate([
        {
          $group: {
            _id: {
              _isLess: {
                $cond: [
                  {
                    // older than the curr date - 30s
                    $lt: reqDate,
                  },
                  1,
                  0,
                ],
              },
            },
            data: "$$ROOT",
          },
        },
      ])
      .toArray(callback);
  })();
  console.log({ item });
} catch (e) {
  console.log(e);
}

export function findOne(collection, ...query) {
  return promisify((callback) => collection.findOne(...query, callback))();
}

export function find(collection, query) {
  return promisify((callback) => collection.find(query).toArray(callback))();
}

export function updateOne(collection, ...query) {
  return promisify((callback) => collection.update(...query, callback))();
}

export async function insertOne(collection, doc) {
  let newData = await promisify((callback) =>
    collection.insert([doc], callback)
  )();
  return newData?.[0] || newData;
}

export function insertMany(collection, query) {
  return promisify((callback) => collection.insert(query, callback))();
}
