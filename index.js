import Fastify from "fastify";
import { handleChatRoom } from "./controllers/chat.js";
import socketioServer from "fastify-socket.io";
import cors from "@fastify/cors";
import fastify from "fastify";
import clientPromise from "./lib/db/mongodb.js";
import { config } from "./config.js";
import {
  find,
  findOne,
  getLocalDatabase,
  insertOne,
  updateOne,
} from "./lib/db/tingodb.js";
import { promisify } from "util";
import { cleanseIPAddress } from "./lib/utils.js";

const public_ip = process.env.PUBLIC_IP;
const port = process.env.PORT;

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
  let db = getLocalDatabase();
  let roomCollection = db.collection("rooms");
  let newRoom = await insertOne(roomCollection, {
    pixels: {},
    users: {},
    expiresAt: new Date(),
  });
  db.close();
  newRoomWorkflow(newRoom);
  if (!newRoom) {
    console.info("Save unsuccessful");
    return { success: false, data: null };
  }
  return {
    success: true,
    data: { roomId: newRoom._id, expiresAt: newRoom.expiresAt },
  };
});

// app.get("/chat/:roomId", handleChatRoom);

app.ready(async (err) => {
  if (err) throw err;
  let db = getLocalDatabase();
  let roomCollection = db.collection("rooms");
  let rooms = await find(roomCollection, {});
  rooms.forEach((room) => {
    newRoomWorkflow(room, roomCollection);
  });
});

function newRoomWorkflow(room, collection) {
  // Common to the whole room
  let pixelData = {};
  let users = room.users;
  const roomio = app.io.of(`/room/${room._id}`);
  roomio.on("connect", async (socket) => {
    let ipAddress = cleanseIPAddress(socket.handshake.address);
    let userData = users[ipAddress] || null;
    if (!userData) {
      room = await findOne(collection, { _id: room._id });
      users = room.users;
      userData = room[ipAddress];
      console.log({ userData });
    }
    console.log("New connection from " + ipAddress);
    console.info("Socket Connected!", socket.id);
    socket.emit("init", {
      // TODO: Persist pixel data in the database?
      pixels: pixelData,
    });
    socket.onAny((event, ...args) => {
      console.log(`${event} fired with args ${JSON.stringify(args)}...`);
    });

    socket.on("message", (data) => {
      console.log({ receivedData: data });
    });

    socket.on("pixel-put", async (...args) => {
      let data = args[0];

      console.log();

      if (userData && Date.now() - userData.lastInputTime < config.timeout) {
        console.log(
          "SCAMM - wait till ",
          config.timeout - Date.now() + userData.lastInputTime
        );
      } else {
        userData = { ipAddress: ipAddress, lastInputTime: Date.now() };
        if (pixelData.hasOwnProperty(data.row)) {
          pixelData[data.row][data.column] = data.color;
        } else {
          pixelData[data.row] = { [data.column]: data.color };
        }
        roomio.emit("pixel-update", {
          row: data.row,
          color: data.color || "pink",
          column: data.column,
        });

        socket.on("disconnect", async (reason) => {
          // Persist data to the database if the user exists
          console.log("DISCONNECT");
          if (userData) {
            console.log("PERSISTING");
            let toLog = await updateOne(
              collection,
              { _id: room._id },
              { $set: { [`users.${ipAddress}`]: userData } },
              { upsert: true }
            );
            console.log(toLog, "DONE");
          }
        });
      }
    });
  });
}

app.listen(port || 3000, public_ip || "0.0.0.0");
