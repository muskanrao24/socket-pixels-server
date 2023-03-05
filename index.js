import Fastify from "fastify";
import { handleChatRoom } from "./controllers/chat.js";
import socketioServer from "fastify-socket.io";
import cors from "@fastify/cors";
import fastify from "fastify";
import clientPromise from "./lib/db/mongodb.js";
import { config } from "./config.js";

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

// app.get("/chat/:roomId", handleChatRoom);

app.ready((err) => {
  if (err) throw err;
  const roomio = app.io.of("/room");
  roomio.on("connect", (socket) => {
    let userData = null;
    let conn, db, users;
    var ipAddress = socket.handshake.address;
    console.log("New connection from " + ipAddress);
    console.info("Socket Connected!", socket.id);
    socket.onAny((event, ...args) => {
      console.log(`${event} fired with args ${JSON.stringify(args)}...`);
    });

    socket.on("message", (data) => {
      console.log({ receivedData: data });
    });

    socket.on("pixel-put", async (...args) => {
      let data = args[0];
      if (!conn) {
        conn = await clientPromise;
        db = conn.db("socket-chat");
        users = db.collection("users");
      }

      // let data = await users.find({}).toArray();

      // console.log({ users: data });
      let ipUser = userData || (await users.findOne({ ipAddress: ipAddress }));

      userData = ipUser;

      if (ipUser && Date.now() - userData.lastInputTime < config.timeout) {
        console.log(
          "SCAMM - wait till ",
          config.timeout - Date.now() + userData.lastInputTime
        );
      } else {
        console.log({ data });
        if (userData) {
          userData = { ipAddress: ipAddress, lastInputTime: Date.now() };
        } else {
          // New User IP Address
          userData = { ipAddress: ipAddress, lastInputTime: Date.now() };
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
            conn = await clientPromise;
            db = conn.db("socket-chat");
            users = db.collection("users");

            users.updateOne(
              { ipAddress: userData.ipAddress },
              { $set: userData },
              { upsert: true }
            );
          }
        });
      }
    });
  });
});

app.listen(port || 3000, public_ip || "0.0.0.0");
