const express = require("express");
const router = express.Router();
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const User = require("../models/user.reg.model");

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "server/uploads/");
  },
  filename: function (req, file, cb) {
    console.log(file);
    cb(null, file.originalname );
  },
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB file size limit
  },
  fileFilter: function (req, file, cb) {
    const allowedTypes = /jpeg|jpg|png|gif/;
    const extname = allowedTypes.test(
      path.extname(file.originalname).toLowerCase()
    );
    const mimetype = allowedTypes.test(file.mimetype);
    if (extname && mimetype) {
      cb(null, true);
    } else {
      cb(new Error("Only images are allowed."));
    }
  },
});

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
          user.profileImage = req.files.profilePic[0].path;
        }
        user.profileImage = req.files.profilePic[0].path;
      }

      // Update ID image
      if (req.files.idImage) {
        if (user.idImage) {
          console.log("Deleting old ID image:", user.idImage);
          fs.unlinkSync(path.join(baseDir, `/${user.idImage}`));
          user.profileImage = req.files.profilePic[0].path;
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
          university: user.university,
        },
      });
    } catch (error) {
      console.error("Server error:", error);
      res.status(500).json({ error: "Server error." });
    }
  }
);
// Route to get user's videos
router.get("/:email/videos", async (req, res) => {
  try {
    const user = await User.findOne({ email: req.params.email });
    if (!user) {
      return res.status(404).send("User not found");
    }
    res.json(user.videos);
  } catch (error) {
    res.status(500).send(error.message);
  }
});

// Route to add/update a video link
router.post("/:email/videos", async (req, res) => {
  try {
    const { subject, embedLink } = req.body;
    const user = await User.findOne({ email: req.params.email });
    if (!user) {
      return res.status(404).send("User not found");
    }

    const videoIndex = user.videos.findIndex(
      (video) => video.subject === subject
    );
    if (videoIndex !== -1) {
      user.videos[videoIndex].embedLink = embedLink;
    } else {
      user.videos.push({ subject, embedLink });
    }

    await user.save();
    res.json(user.videos);
  } catch (error) {
    res.status(500).send(error.message);
  }
});

// Route to delete a video link
router.delete("/:email/videos", async (req, res) => {
  try {
    const { subject } = req.body;
    const user = await User.findOne({ email: req.params.email });
    if (!user) {
      return res.status(404).send("User not found");
    }

    user.videos = user.videos.filter((video) => video.subject !== subject);
    await user.save();
    res.json(user.videos);
  } catch (error) {
    res.status(500).send(error.message);
  }
});

module.exports = router;
