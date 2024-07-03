const mongoose = require("mongoose");


const messageSchema = new mongoose.Schema({
    userEmail: { type: String, required: true },
    recipientEmail: { type: String, required: true },
    text: { type: String, required: true },
    postedOn: { type: String, required: true },
    userImage: { type: String, required: true },
  });
  
  const Message = mongoose.model("Message", messageSchema);
  
module.exports = Message;
