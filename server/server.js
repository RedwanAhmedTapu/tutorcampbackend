const express = require("express");
const http = require("http");
const socketIO = require("socket.io");
const cors = require("cors");

const app = express();
const server = http.createServer(app);
const io = socketIO(server, {
  cors: {
    origin: "*",
  },
});

const PORT = process.env.PORT || 5000;

const emailToSocketIdMap = new Map();
const socketIdToEmailMap = new Map();

io.on("connection", (socket) => {
  console.log(`Socket Connected: ${socket.id}`);

  socket.on("room-join", (data) => {
    const { room, email } = data;
    console.log(`User with email: ${email} joined room: ${room}`);

    socket.join(room);
    emailToSocketIdMap.set(email, socket.id);
    socketIdToEmailMap.set(socket.id, email);

    socket.emit("joined-room", room);
    io.to(room).emit("new-user-joined", { email });
  });

  socket.on("sendOffer", (data) => {
    const { email, offer, roomId } = data;
    const recipientSocketId = emailToSocketIdMap.get(email);
    if (recipientSocketId) {
      console.log(`Sending offer to ${email} (${recipientSocketId})`);
      io.to(recipientSocketId).emit("receiveOffer", { from: socketIdToEmailMap.get(socket.id), offer });
    } else {
      console.log(`Recipient's socket ID not found for email: ${email}`);
    }
  });

  socket.on("sendAnswer", (data) => {
    const { email, answer } = data;
    const recipientSocketId = emailToSocketIdMap.get(email);
    if (recipientSocketId) {
      console.log(`Sending answer to ${email} (${recipientSocketId})`);
      io.to(recipientSocketId).emit("receiveAnswer", { from: socketIdToEmailMap.get(socket.id), answer });
    } else {
      console.log(`Recipient's socket ID not found for email: ${email}`);
    }
  });

  socket.on("sendIceCandidate", (data) => {
    const { candidate, recipientEmail } = data;
    const recipientSocketId = emailToSocketIdMap.get(recipientEmail);
    if (recipientSocketId) {
      console.log(`Sending ICE candidate to ${recipientEmail} (${recipientSocketId})`);
      io.to(recipientSocketId).emit("receiveIceCandidate", { candidate });
    } else {
      console.log(`Recipient's socket ID not found for email: ${recipientEmail}`);
    }
  });

  socket.on("disconnect", () => {
    const email = socketIdToEmailMap.get(socket.id);
    if (email) {
      console.log(`User with email: ${email} disconnected`);
      emailToSocketIdMap.delete(email);
      socketIdToEmailMap.delete(socket.id);
    }
  });
});

server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
