const bcrypt = require('bcrypt');
const UserModel = require('../models/user.reg.model');

const userRegistration = async (req, res) => {
  console.log(req.body);
  try {
    const existingUser = await UserModel.findOne({ email: req.body.email });

    if (existingUser) {
      return res.status(409).json({ message: 'User already exists' });
    }

    // Hash the password
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(req.body.password, saltRounds);

    // Create a new user with the hashed password
    const newUser = new UserModel({
      ...req.body,
      password: hashedPassword
    });

    await newUser.save();
    res.status(201).json({ message: "User registered successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

module.exports = userRegistration;
