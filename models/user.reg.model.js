const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  fname: String,
  lname: String,
  email: { type: String, unique: true, required: true },
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
  webAuthn: {
    credentialID: String,
    credentialPublicKey: String,
    counter: Number,
    challenge: String, // Added challenge field
    loginChallenge: String, // Added challenge field
  },
});

const UserModel = mongoose.model("User", userSchema);

module.exports = UserModel;
