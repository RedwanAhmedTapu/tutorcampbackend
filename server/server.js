const express = require("express");
const http = require("http");
const socketIO = require("socket.io");

const app = express();
const server = http.createServer(app);
const cors = require("cors");

require("dotenv").config();
require("../db/connection");

const io = socketIO(server, {
  cors: {
    origin:"https://tutorcamp.vercel.app",
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  },
});

app.use(
  cors({
    origin:"https://tutorcamp.vercel.app",
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  })
);

app.use(express.json());

const activeClasses = {};

io.on("connection", (socket) => {
  console.log("User connected: " + socket.id);

  socket.on("create-class", () => {
    const classId = "class-" + Math.random().toString(36).substring(7);
    console.log(classId);
    activeClasses[classId] = { teacherSocketId: socket.id, studentSockets: [] };
    socket.join(classId);
    socket.emit("class-created", classId);

    console.log(`Class created: ${classId} by Teacher: ${socket.id}`);
  });

  socket.on("join-class", (data) => {
    const { classId, studentId } = data;
    console.log(data);
    const classInfo = activeClasses[classId];
    if (classInfo) {
      classInfo.studentSockets.push(socket.id);
      socket.join(classId);
      io.to(classId).emit("student-joined", studentId);
      console.log(`Student ${studentId} joined Class: ${classId}`);
    } else {
      socket.emit("class-not-found");
    }
  });

  socket.on("offer", (offer) => {
    const { offer: offerData, receiverId } = offer;
    io.to(receiverId).emit("offer", { offer: offerData, senderId: socket.id });
  });

  socket.on("answer", (answer) => {
    const { answer: answerData, receiverId } = answer;
    io.to(receiverId).emit("answer", { answer: answerData, senderId: socket.id });
  });

  socket.on("ice-candidate", (candidate) => {
    const { candidate: candidateData, receiverId } = candidate;
    io.to(receiverId).emit("ice-candidate", { candidate: candidateData, senderId: socket.id });
  });

  socket.on("disconnect", () => {
    console.log("User disconnected: " + socket.id);
  });
});

app.get("/", async (req, res) => {
  res.send("tutorcampbackend");
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
