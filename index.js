import Fastify from "fastify";
import socketioServer from "fastify-socket.io";
import cors from "@fastify/cors";
import { find, getLocalDatabase, insertOne } from "./lib/db/tingodb.js";
import ObjectID from "tingodb/lib/ObjectId.js";
import { RoomHandler } from "./lib/room-utils.js";

const public_ip = process.env.PUBLIC_IP;
const port = process.env.PORT;

let db = getLocalDatabase();
let roomCollection = db.collection("rooms");

const app = Fastify({
  logger: true,
});

app.register(socketioServer, {
  cors: {
    origin: "*",
  },
});
app.register(cors, {
  origin: "*",
});

app.get("/", (request, response) => {
  // app.io.emit("Hello World!");
  console.log({ ip: request.socket.remoteAddress });
  console.log("OI");
  return { data: "Hello World!", err: null };
});

app.post("/createroom", async (request, response) => {
  console.log({ body: request.body });
  let newRoom = await insertOne(roomCollection, {
    pixels: {},
    users: {},
    expiresAt: new Date(),
  });
  if (!newRoom) {
    console.info("Save unsuccessful");
    return { success: false, data: null };
  }
  new RoomHandler(
    app.io.of(`/room/${newRoom._id}`),
    newRoom,
    roomCollection
  ).handle();
  return {
    success: true,
    data: { roomId: newRoom._id, expiresAt: newRoom.expiresAt },
  };
});

app.ready(async (err) => {
  if (err) throw err;
  let rooms = await find(roomCollection, {});
  // Start workflow for previous rooms
  rooms.forEach((room) => {
    new RoomHandler(
      app.io.of(`/room/${room._id}`),
      room,
      roomCollection
    ).handle();
  });
});

app.listen(port || 3000, public_ip || "0.0.0.0");
