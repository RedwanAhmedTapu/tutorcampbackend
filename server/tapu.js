const express = require('express');
const http = require('http');
const socketIO = require('socket.io');

const app = express();
const server = http.createServer(app);
const cors = require("cors");

const PORT = process.env.PORT || 5000;

require("dotenv").config();
require("../db/connection");
const io = socketIO(server, {
  cors: {
    origin: process.env.ORIGIN, // Replace with your frontend URL
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  },
});

app.use(
  cors({
    origin: process.env.ORIGIN, // Replace with your frontend URL
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  })
);

const emailToSocketIdMap = new Map();
const socketidToEmailMap = new Map();

io.on("connection", (socket) => {
  console.log(`Socket Connected`, socket.id);

  socket.on("room-join", (data) => {
    const { roomId } = data;
    socket.join(roomId);

    // Emitting the "newjoining" event to the room when a new user joins
    io.to(roomId).emit("newjoining", { id: socket.id });
  });

  socket.on("sendTheOffer", (offer, roomId) => {
    console.log(offer, "offer");
    io.to(roomId).emit("recieveOffer", offer);
  });

  socket.on("sendTheAnswer", (ans, roomId) => {
    console.log(ans, "answer");
    io.to(roomId).emit("recieveAnswer", ans);
  });

  // Receive ICE candidates
  socket.on("sendIceCandidate", (candidate, roomId) => {
    console.log("Received ICE candidate:", candidate);
    io.to(roomId).emit("receiveIceCandidate", candidate);
  });
});

server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});