import tingodb from "tingodb";
var Db = tingodb().Db;
import { promisify } from "util";

export function getLocalDatabase(path = "./data/tingo", options = {}) {
  let db = new Db(path, options);
  return db;
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
