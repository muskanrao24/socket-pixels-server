import Fastify from "fastify";
import { handleChatRoom } from "./controllers/chat.js";
import socketioServer from "fastify-socket.io";
import cors from "@fastify/cors";
import fastify from "fastify";

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
  console.log("OI");
});

// app.get("/chat/:roomId", handleChatRoom);

app.ready((err) => {
  if (err) throw err;
  const roomio = app.io.of("/room");
  roomio.on("connect", (socket) => {
    var address = socket.handshake.address;
    console.log("New connection from " + address);
    console.info("Socket Connected!", socket.id);
    socket.onAny((event, ...args) => {
      console.log(`${event} fired with args ${args}...`);
    });

    socket.on("message", (data) => {
      console.log({ receivedData: data });
    });

    socket.on("pixel-put", (data) => {
      console.log({ data });
      roomio.emit("pixel-update", {
        row: data.row,
        color: data.color || "pink",
        column: data.column,
      });
    });
  });
});

app.listen({
  port: 3000,
});
