const express = require("express");
const router = express.Router();
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const User = require("../models/user.reg.model");
const { storage, upload } = require("../middleweare/multer");

// Route to update profile picture, ID image, and university
router.post(
  "/info/update/:email",
  upload.fields([
    { name: "profilePic", maxCount: 1 },
    { name: "idImage", maxCount: 1 },
  ]),
  async (req, res) => {
    try {
      const userEmail = req.params.email;
      const { university } = req.body;

      console.log("Request received for email:", userEmail);
      console.log("Request body:", req.body);
      console.log("Uploaded files:", req.files);

      const user = await User.findOne({ email: userEmail });
      if (!user) {
        return res.status(404).json({ error: "User not found." });
      }

      const baseDir = path.join(__dirname, "..");
      // Update profile picture
      if (req.files.profilePic) {
        if (user.profileImage) {
          console.log("Deleting old profile picture:", user.profileImage);
          fs.unlinkSync(path.join(baseDir, `/${user.profileImage}`));
        }
        user.profileImage = req.files.profilePic[0].path;
      }

      // Update ID image
      if (req.files.idImage) {
        if (user.idImage) {
          console.log("Deleting old ID image:", user.idImage);
          fs.unlinkSync(path.join(baseDir, `/${user.idImage}`));
        }
        user.idImage = req.files.idImage[0].path;
      }

      // Update university
      if (university) {
        user.institution = university;
      }

      await user.save();

      res.json({
        message: "Information updated successfully.",
        user: {
          profileImage: user.profileImage,
          idImage: user.idImage,
          university: user.institution,
        },
      });
    } catch (error) {
      console.error("Server error:", error);
      res.status(500).json({ error: "Server error." });
    }
  }
);

// Route to get student's profile information
router.get("/:email/profile", async (req, res) => {
  try {
    const user = await User.findOne({ email: req.params.email });
    if (!user) {
      return res.status(404).send("User not found");
    }
    res.json({
      profileImage: user.profileImage,
      idImage: user.idImage,
      institution: user.institution,
    });
  } catch (error) {
    res.status(500).send(error.message);
  }
});

module.exports = router;
