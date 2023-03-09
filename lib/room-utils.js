import { Namespace } from "socket.io";
import pkg from "tingodb/lib/ObjectId.js";
const { ObjectID } = pkg;
import { cleanseIPAddress } from "./utils.js";
import { findOne, updateOne } from "./db/tingodb.js";

/**
 * @typedef {{ ipAddress: string, lastInputTime: Date }} User
 * @typedef {{ color: string, row: number, column: number }} Pixel
 * @typedef {{ [row: number]: { [column: number]: string } }} Pixels
 * @typedef {{ [ipAddress: string]: User }} Users
 * @typedef {{ row: number, column: number }} GridSize
 * @typedef {Array<string>} ColorList
 * @typedef {number} Timeout
 * @typedef {{_id: ObjectID, users: { [ipAddress: string]: User }, pixels: { [row: number]: { [column: number]: string } }, gridSize: GridSize, colors: ColorList, timeout: Timeout}} RawRoom
 */

export class Room {
  /**
   * @param {RawRoom} room
   */
  constructor(room) {
    /** @type {ObjectID} */
    this._id = room._id;
    /** @type {Pixels} */
    this.pixels = room.pixels;
    /** @type {Users} */
    this.users = room.users;
    /** @type {GridSize} */
    this.gridSize = room.gridSize;
    /** @type {ColorList} */
    this.colors = room.colors;
    /** @type {Timeout} */
    this.timeout = room.timeout;
  }
  /**
   * @param  {Pixels} pixelData
   */
  setPixels(pixelData) {
    this.pixels = pixelData;
    return this;
  }
  /**
   * Get the user object with ip address
   * @param {string} ipAddress The IP Address with . replaced by p
   * @returns {User?} The user with the ipaddress
   */
  getUser(ipAddress) {
    return this.users[ipAddress] || null;
  }
  /**
   * @param  {Users} usersData
   */
  setUsers(usersData) {
    this.users = usersData;
    return this;
  }
  /**
   * @param  {User} user
   */
  upsertUser(user) {
    this.users[user.ipAddress] = user;
  }
  /**
   * @param  {Pixel} pixel
   */
  addPixel(pixel) {
    if (this.pixels.hasOwnProperty(pixel.row)) {
      this.pixels[pixel.row][pixel.column] = pixel.color;
    } else {
      this.pixels[pixel.row] = { [pixel.column]: pixel.color };
    }
    return this;
  }
}

export class RoomHandler {
  /**
   * @param {Namespace<import("socket.io/dist/typed-events").DefaultEventsMap, import("socket.io/dist/typed-events").DefaultEventsMap, import("socket.io/dist/typed-events").DefaultEventsMap, any>} roomio
   * @param  {RawRoom} room The room object in the database
   * @param  {any} collection The collection instance of the rooms collection in database
   */
  constructor(roomio, room, collection) {
    /** @type {Room} */
    this.room = new Room(room);
    this.collection = collection;
    this.stale = false;
    this.roomio = roomio;
  }
  handle() {
    this.roomio.on("connect", async (socket) => {
      // For each user
      let ipAddress = cleanseIPAddress(socket.handshake.address);
      // Update room details from the database if the data is stale
      if (this.stale) {
        /** @type {RawRoom} */
        let rawroom = await findOne(this.collection, { _id: this.room._id });
        this.room.setUsers(rawroom.users);
        this.stale = false;
      }
      console.log("New connection from " + ipAddress);
      console.info("Socket Connected!", socket.id);
      console.log({ Pixels: JSON.stringify(this.room.pixels) });
      socket.emit("init", {
        // TODO: Persist pixel data in the database?
        pixels: this.room.pixels,
        gridSize: this.room.gridSize,
        colors: this.room.colors,
      });
      socket.onAny((event, ...args) => {
        console.log(`${event} fired with args ${JSON.stringify(args)}...`);
      });

      socket.on("message", (data) => {
        console.log({ receivedData: data });
      });

      socket.on("pixel-put", async (...args) => {
        let data = args[0];

        let userData = this.room.getUser(ipAddress);

        console.log({ userData });

        if (
          userData &&
          Date.now() - userData.lastInputTime < this.room.timeout
        ) {
          console.log(
            "SCAMM - wait till ",
            this.room.timeout - Date.now() + userData.lastInputTime
          );
          socket.emit("wait", {
            waitTime: this.room.timeout - Date.now() + userData.lastInputTime,
          });
        } else {
          // Update userData with current time
          this.room.upsertUser({
            ipAddress: ipAddress,
            lastInputTime: Date.now(),
          });
          this.room.addPixel({
            color: this.room.colors[data.colorId],
            row: data.row,
            column: data.column,
          });
          this.roomio.emit("pixel-update", {
            row: data.row,
            color: this.room.colors[data.colorId],
            column: data.column,
          });
        }
      });
      socket.on("disconnect", async (reason) => {
        // Persist data to the database if the user exists
        let userData = this.room.getUser(ipAddress);
        if (userData) {
          let toLog = await updateOne(
            this.collection,
            { _id: this.room._id },
            { $set: { [`users.${ipAddress}`]: userData } },
            { upsert: true }
          );
          console.log(toLog, "DONE");
        }
        this.stale = true;
      });
    });
  }
}
