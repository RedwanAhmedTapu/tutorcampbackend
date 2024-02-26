const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  fname: String,
  lname: String,
  email: String,
  password: String,
  userType: String,
  subjects: [String],
});

const UserModel = mongoose.model('User', userSchema);

module.exports = UserModel;
