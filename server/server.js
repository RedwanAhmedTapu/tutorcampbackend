const express = require("express");
const http = require("http");
const socketIO = require("socket.io");
const cors = require("cors");
const { sourceMapsEnabled } = require("process");
const path = require("path");
const fileUpload = require("express-fileupload");
const tesseract = require("tesseract.js");
const sharp = require("sharp");
const math = require("mathjs");
const {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
  base64urlToBuffer,
} = require("@simplewebauthn/server");
const base64url = require("base64url");

const app = express();
const server = http.createServer(app);
const UserModel = require("../models/user.reg.model");
const Message = require("../models/chatmessage.model");
const tokenBasedAuthentication = require("../middleweare/authenticationToken");

const userRegistration = require("../routes/user.reg");
const userlogin = require("../routes/user-login");
const teacherDashBoardRoutes = require("../routes/teacher-dashboard-route");
const studentDashBoardRoutes = require("../routes/student-dashboard");
const adminRoutes = require("../routes/adminRoutes");

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
app.use(fileUpload());

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

function formatMathExpression(text) {
  text = text
    .replace(/Examp1e/g, "Example")
    .replace(/\|/g, "∫")
    .replace(/G/g, "∫")
    .replace(/x5/g, "x^5")
    .replace(/dx/g, " dx")
    .replace(/n\+1/g, "x^n+1");

  const replacements = {
    O: "0",
    l: "1",
    " ": "",
  };

  for (const [key, value] of Object.entries(replacements)) {
    text = text.split(key).join(value);
  }

  text = text
    .replace(/∫/g, "∫ ")
    .replace(/dx/g, " dx")
    .replace(/\s{2,}/g, " ");

  return text;
}

app.post("/api/upload", async (req, res) => {
  if (!req.files || !req.files.file) {
    return res.status(400).send("No file uploaded.");
  }

  const file = req.files.file;

  try {
    const preProcessedBuffer = await sharp(file.data)
      .resize({ width: 800 })
      .grayscale()
      .toBuffer();

    tesseract
      .recognize(preProcessedBuffer, "eng+ben", { logger: (m) => m })
      .then(({ data: { text } }) => {
        console.log("Recognized text:", text);

        try {
          const cleanedText = formatMathExpression(text);
          const solution = math.evaluate(cleanedText);
          console.log(math, "math");
          res.json({ solution: solution.toString() });
        } catch (error) {
          console.error("Error parsing or solving math expression:", error);
          res.status(400).send("Error parsing or solving math expression.");
        }
      })
      .catch((error) => {
        console.error("Error processing image:", error);
        res.status(500).send("Error processing image.");
      });
  } catch (error) {
    console.error("Error during image pre-processing:", error);
    res.status(500).send("Error during image pre-processing.");
  }
});

app.post("/user/signup", userRegistration);
app.post("/user/login", userlogin);
// function base64urlToBuffer(base64url) {
//   if (!base64url) {
//     throw new Error("base64url is undefined or null");
//   }

//   // Replace non-base64 characters with base64 characters
//   let base64 = base64url
//     .replace(/-/g, '+')
//     .replace(/_/g, '/');

//   // Pad with "=" if necessary
//   const padding = base64.length % 4;
//   if (padding) {
//     base64 += '='.repeat(4 - padding);
//   }

//   // Convert base64 to buffer
//   return Buffer.from(base64, 'base64');
// }

app.get("/webauthn/reg-options", async (req, res) => {
  console.log("Request received for reg-options");

  try {
    const { email } = req.query;
    const user = await UserModel.findOne({ email });
    console.log("User found:", user);

    if (!user) {
      return res.status(404).send("User not found");
    }

    const userIDBuffer = Buffer.from(user._id.toString(), "hex");

    console.log("Generating registration options");
    const options = await generateRegistrationOptions({
      rpName: "Your RP Name",
      rpID: "localhost",
      userID: userIDBuffer,
      userName: email,
      attestationType: "direct",
      authenticatorSelection: {
        authenticatorAttachment: "platform",
        requireResidentKey: false,
        userVerification: "preferred",
      },
    });

     // Save the challenge to the user's document
     user.webAuthn = {
      ...user.webAuthn,
      challenge: options.challenge
    };
    await user.save();
    console.log("Registration Options:", options); // This should log the resolved options
    
    res.json(options);
  } catch (error) {
    console.error("Error generating registration options:", error);
    res.status(500).send("Internal server error");
  }
});

app.post("/webauthn/reg-verify", async (req, res) => {
  const { email, ...body } = req.body;
  console.log(req.body)
  
  try {
    const user = await UserModel.findOne({ email });
    if (!user) {
      return res.status(404).send("User not found");
    }

    // Ensure challenge is retrieved and converted properly
    const expectedChallenge = user.webAuthn.challenge;

    const verification = await verifyRegistrationResponse({
      response: body,
      expectedChallenge: expectedChallenge,
      expectedOrigin: "http://localhost:3000", // Your origin
      expectedRPID: "localhost", // Your RPID
      // Provide any other required parameters
    });

    if (verification.verified) {
      user.webAuthn.credentialID = base64url.encode(verification.registrationInfo.credentialID);
      user.webAuthn.credentialPublicKey = base64url.encode(verification.registrationInfo.credentialPublicKey);
      user.webAuthn.counter = verification.registrationInfo.counter;
      await user.save();

      res.json({ verified: true });
    } else {
      res.status(400).send("Registration verification failed");
    }
  } catch (error) {
    console.error("Error during registration verification:", error);
    res.status(500).send("Internal server error");
  }
});

// Endpoint to get authentication options
app.get("/webauthn/auth-options", async (req, res) => {
  console.log("Request received for auth-options");

  try {
    const { email } = req.query;
    const user = await UserModel.findOne({ email });
    // console.log("User found:", user);

    if (!user) {
      return res.status(404).send("User not found");
    }

    // Ensure credentialID is a base64url encoded string
    if (!user.webAuthn.credentialID) {
      return res.status(400).send("User does not have a credentialID");
    }

    let credentialIDBuffer;
    try {
      console.log("ok")
      credentialIDBuffer = base64url.toBuffer(user.webAuthn.credentialID);
    } catch (e) {
      console.error("Error decoding credentialID:", e);
      return res.status(400).send("Invalid credentialID format");
    }

    const options = await generateAuthenticationOptions({
      rpID:process.env.LOCALHOST,
      userVerification: "preferred",
      allowCredentials: [
        {
          id: credentialIDBuffer.toString('utf8'),
          type: "public-key",
          transports: ["usb", "ble", "nfc", "internal"]
        }
      ]
    });
     // Save the challenge to the user's document
     user.webAuthn = {
      ...user.webAuthn,
      loginChallenge: base64url.encode(options.challenge)
    };
    await user.save();

    console.log("Authentication Options:", options);
    res.json(options);
  } catch (error) {
    console.error("Error generating authentication options:", error);
    res.status(500).send("Internal server error");
  }
});


// Endpoint to verify authentication response
app.post("/webauthn/auth-verify", async (req, res) => {
  const { email, ...body } = req.body;
  console.log("Email:", email);
  console.log("Body:", body);

  try {
    const user = await UserModel.findOne({ email });
    if (!user) {
      return res.status(404).send("User not found");
    }

    // Debug logging
    console.log("User WebAuthn Data for Verification:", user.webAuthn.loginChallenge);

    const expectedChallenge = base64url.decode(user.webAuthn.loginChallenge);
    const responseChallenge = body.response.clientDataJSON;
    
    // Parse the clientDataJSON to get the challenge
    const clientDataJSON = JSON.parse(base64url.decode(responseChallenge));
    const receivedChallenge = clientDataJSON.challenge;
    
    console.log("Expected Challenge:", expectedChallenge);
    console.log("Received Challenge:", receivedChallenge);

    const verification = await verifyAuthenticationResponse({
      response: body,
      expectedChallenge: expectedChallenge,
      expectedOrigin: process.env.ORIGIN, // Change this to your origin
      expectedRPID:  process.env.LOCALHOST, // Change this to your RPID
      authenticator: {
        credentialPublicKey: base64url.toBuffer(user.webAuthn.credentialPublicKey),
        credentialID: base64url.toBuffer(user.webAuthn.credentialID),
        counter: user.webAuthn.counter,
      },
    });

    console.log("Verification:", verification);

    if (verification.verified) {
      user.webAuthn.counter = verification.authenticationInfo.newCounter;
      user.verified=true;
      await user.save();

      // Respond with success and user info (e.g., JWT token)
      res.json({
        verified: true,
        fname: user.fname,
        lname: user.lname,
        email: user.email,
        image: user.profileImage,
        userType: user.userType,
        token: process.env.JWT_TOKEN, // Generate and send your JWT token
      });
    } else {
      res.status(401).send("Authentication failed");
    }
  } catch (error) {
    console.error("Error during authentication verification:", error);
    res.status(500).send("Internal server error");
  }
});
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
  //  console.log(req.query)

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
      io.to(recipientSocketId).emit("message-seen", messageId);
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
