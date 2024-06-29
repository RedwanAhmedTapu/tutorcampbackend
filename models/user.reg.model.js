const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  fname: String,
  lname: String,
  email: { type: String, unique: true, required: true }, // Corrected type to String and added required
  password: { type: String, required: true },
  userType: String,
  subjects: [String],
  profileImage: String,
  idImage: String,
  institution: String,
  videos: [
    {
      subject: String,
      embedLink: String,
    },
  ],
  verified: { type: Boolean, default: false },
});

const UserModel = mongoose.model("User", userSchema);

module.exports = UserModel;
