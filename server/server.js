const express = require("express");
const http = require("http");
const socketIO = require("socket.io");
const cors = require("cors");
const { sourceMapsEnabled } = require("process");
const path = require("path");

const app = express();
const server = http.createServer(app);
const UserModel = require("../models/user.reg.model");
const Message = require("../models/chatmessage.model");
const tokenBasedAuthentication = require("../middleweare/authenticationToken");

const userRegistration = require("../routes/user.reg");
const userlogin = require("../routes/user-login");
const teacherDashBoardRoutes = require("../routes/teacher-dashboard-route");
const studentDashBoardRoutes = require("../routes/student-dashboard");
const adminRoutes = require('../routes/adminRoutes');

require("dotenv").config();
require("../db/connection");

app.use(
  cors({
    origin: "*",
  })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use("/server/uploads", express.static(path.join(__dirname, "uploads")));
console.log(__dirname);

const io = socketIO(server, {
  cors: {
    origin: process.env.ORIGIN, // Replace with your frontend URL
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  },
});

console.log(process.env.PORT);
const PORT = process.env.PORT || 5000;

app.post("/user/signup", userRegistration);
app.post("/user/login", userlogin);
// Define a route to get user data
app.get("/users", async (req, res) => {
  try {
    const users = await UserModel.find().select("-password"); // Exclude the password field
    res.status(200).json(users);
  } catch (error) {
    res.status(500).json({ message: "Error fetching users", error });
  }
});

// Routes
app.use("/teacher", tokenBasedAuthentication, teacherDashBoardRoutes);
app.use("/student", tokenBasedAuthentication, studentDashBoardRoutes);
app.use("/admin", tokenBasedAuthentication, adminRoutes);

// chatmessaging

app.get("/api/messages", async (req, res) => {
  const { userEmail, recipientEmail } = req.query;
   console.log(req.query)

  let messages;
  if (userEmail && recipientEmail) {
    messages = await Message.find({
      $or: [
        { userEmail: userEmail, recipientEmail: recipientEmail },
        { userEmail: recipientEmail, recipientEmail: userEmail },
      ],
    });
  } else {
    messages = await Message.find({ userEmail });
  }
  res.json(messages);
});
app.get("/api/single-messages", async (req, res) => {
  const { userEmail } = req.query;

  const messages = await Message.findOne({
    userEmail,
  });
  res.json(messages);
});

const emailToSocketIdMapChat = new Map();
const socketIdToEmailMapChat = new Map();

let users = {};
io.on("connection", (socket) => {
  console.log("a user connected");

  // Handle user online status
  socket.on("user-online", (userId) => {
    users[userId] = true;
    io.emit("update-user-status", users);
  });

  socket.on("user-offline", (userId) => {
    users[userId] = false;
    io.emit("update-user-status", users);
  });

  // Register user socket
  socket.on("register", (email) => {
    emailToSocketIdMapChat.set(email, socket.id);
    socketIdToEmailMapChat.set(socket.id, email);
  });

  // Handle user disconnect
  socket.on("disconnect", () => {
    const email = socketIdToEmailMapChat.get(socket.id);
    emailToSocketIdMapChat.delete(email);
    socketIdToEmailMapChat.delete(socket.id);
    console.log("user disconnected");
  });

  // Handle new messages
  socket.on("newMessage", async (message) => {
    const { userEmail, recipientEmail, text, postedOn, userImage } = message;

    const newMessage = new Message({
      userEmail,
      recipientEmail,
      text,
      postedOn,
      userImage,
      seen: false,
    });
    await newMessage.save();

    const recipientSocketId = emailToSocketIdMapChat.get(recipientEmail);
    if (recipientSocketId) {
      io.to(recipientSocketId).emit("newMessage", {
        newMessage,
        recipientSocketId,
      });
    }
    socket.emit("newMessage", { newMessage, recipientSocketId });
  });

  // Handle message seen
  socket.on("message-seen", async (messageId) => {
    try {
      await Message.findByIdAndUpdate(messageId, { seen: true });
      io.to(recipientSocketId).emit("message-seen",messageId);
      socket.emit("message-seen", messageId);
    } catch (error) {
      console.error("Error updating message seen status:", error);
    }
  });
});

// for videoMeeting
const emailToSocketIdMap = new Map();
const socketIdToEmailMap = new Map();

io.on("connection", (socket) => {
  console.log(`Socket Connected: ${socket.id}`);

  socket.on("room-join", (data) => {
    const { room, email } = data;
    console.log(`User with email: ${email} joined room: ${room}`);
    console.log(emailToSocketIdMap, "email to socket");
    console.log(socketIdToEmailMap, "socket to email");

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
      io.to(recipientSocketId).emit("receiveOffer", {
        from: socketIdToEmailMap.get(socket.id),
        offer,
      });
    } else {
      console.log(`Recipient's socket ID not found for email: ${email}`);
    }
  });

  socket.on("sendAnswer", (data) => {
    const { email, answer } = data;
    const recipientSocketId = emailToSocketIdMap.get(email);
    if (recipientSocketId) {
      console.log(`Sending answer to ${email} (${recipientSocketId})`);
      io.to(recipientSocketId).emit("receiveAnswer", {
        from: socketIdToEmailMap.get(socket.id),
        answer,
      });
    } else {
      console.log(`Recipient's socket ID not found for email: ${email}`);
    }
  });

  socket.on("sendIceCandidate", (data) => {
    const { candidate, recipientEmail } = data;
    const recipientSocketId = emailToSocketIdMap.get(recipientEmail);
    if (recipientSocketId) {
      console.log(
        `Sending ICE candidate to ${recipientEmail} (${recipientSocketId})`
      );
      io.to(recipientSocketId).emit("receiveIceCandidate", { candidate });
    } else {
      console.log(
        `Recipient's socket ID not found for email: ${recipientEmail}`
      );
    }
  });

  socket.on("disconnect", () => {
    // disconnection for videomeeting
    const email = socketIdToEmailMap.get(socket.id);
    console.log(socketIdToEmailMap);
    console.log(emailToSocketIdMap);
    if (email) {
      console.log(`User with email: ${email} disconnected`);
      emailToSocketIdMap.delete(email);
      socketIdToEmailMap.delete(socket.id);
    }

    // disconnection for chat application
    for (const userEmail in users) {
      if (users[userEmail] === socket.id) {
        delete users[userEmail];
        break;
      }
    }
    io.emit("update-user-status", users);
    console.log("Client disconnected:", socket.id);
  });

  socket.on("user-offline", (userEmail) => {
    delete users[userEmail];
    io.emit("update-user-status", users);
  });
});

server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
