const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema({
  userEmail: { type: String, required: true },
  recipientEmail: { type: String, required: true },
  text: { type: String, required: true },
  postedOn: { type: String, required: true },
  userImage: { type: String },
  seen: { type: Boolean, default: false },  // New field for seen status
});

const Message = mongoose.model("Message", messageSchema);

module.exports = Message;
