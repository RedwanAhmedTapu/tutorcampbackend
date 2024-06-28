const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  fname: String,
  lname: String,
  email: String,
  password: String,
  userType: String,
  subjects: [String],
  profileImage: String, // Assuming storing URL of profile image
  idImage: String, // Assuming storing ID information
  institution: String, // Assuming storing institution name
  videos: [
    {
      subject: String,
      embedLink: String,
    }
  ],
});

const UserModel = mongoose.model('User', userSchema);

module.exports = UserModel;
