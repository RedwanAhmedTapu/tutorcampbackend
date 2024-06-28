const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const UserModel = require('../models/user.reg.model');

require("dotenv").config();


const JWT_SECRET = process.env.JWT_TOKEN;

const userLogin = async (req, res) => {
  const { email, password } = req.body;
  console.log(req.body);
  try {
    const user = await UserModel.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({ message: 'Invalid password' });
    }

    // Generate a token
    const token = jwt.sign({ fname:user.fname,lname:user.lname, email: user.email, userType: user.userType }, JWT_SECRET, { expiresIn: '1h' });

    res.status(200).json({ message: 'Login successful', token, fname:user.fname,lname:user.lname, email: user.email, userType: user.userType });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

module.exports = userLogin;
