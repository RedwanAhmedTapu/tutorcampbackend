// routes/adminRoutes.js
const express = require('express');
const router = express.Router();
const User = require('../models/user.reg.model');

// Controller to handle deleting a user
const deleteUser = async (req, res) => {
  const { email, role } = req.params;
  console.log(req.params)
  try {
    await User.findOneAndDelete({ email, userType:role });
    res.status(200).json({ message: `${role.charAt(0).toUpperCase() + role.slice(1)} deleted successfully` });
  } catch (error) {
    res.status(500).json({ error: 'An error occurred while deleting the user' });
  }
};

// Controller to handle verifying a teacher
const verifyTeacher = async (req, res) => {
  const { email } = req.params;
  try {
    const teacher = await User.findOneAndUpdate(
      { email, userType: 'teacher' },
      { isVerified: true },
      { new: true }
    );
    res.status(200).json(teacher);
  } catch (error) {
    res.status(500).json({ error: 'An error occurred while verifying the teacher' });
  }
};

// Routes
router.delete('/delete/:role/:email', deleteUser);
router.post('/verify-teacher/:email', verifyTeacher);

module.exports = router;
