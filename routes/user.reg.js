const UserModel=require("../models/user.reg.model");

const userModel=async (req, res) => {
    console.log(req.body.email)
    try {
      const existingUser = await UserModel.findOne({ email: req.body.email });
  
      if (existingUser) {
        return res.status(409).json({ message: 'User already exists' });
      }
  
      const newUser = new UserModel(req.body);
      await newUser.save();
      res.status(201).json(newUser);
    } catch (error) {
      res.status(500).json({ error: 'Internal Server Error' });
    }
  }

  module.exports=userModel;