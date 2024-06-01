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
    const { room, email } = data;
    socket.join(room);
    socket.emit("joined-room", room);

    // Emitting the "new-user-joined" event to the room when a new user joins
    io.to(room).emit("new-user-joined", { email });
  });

  socket.on("sendTheOffer", (data) => {
    const { email, offer } = data;
    io.to(email).emit("recieveOffer", { from: socket.id, offer });
  });

  socket.on("sendTheAnswer", (data) => {
    const { emailID, ans } = data;
    io.to(emailID).emit("recieveAnswer", { ans });
  });

  socket.on("sendIceCandidate", (data) => {
    const { candidate, emailID } = data;
    io.to(emailID).emit("receiveIceCandidate", { candidate });
  });
});

server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
