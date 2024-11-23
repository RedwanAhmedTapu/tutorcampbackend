const fs = require('fs');
const path = require('path');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;

// Configure Cloudinary
cloudinary.config({
  cloud_name: 'dcyrlxyuk',
  api_key: '668925119493549',
  api_secret: 'pp78JnYCAYbniPg0bpKQBYUlVOw',
});

// Set up multer for file upload
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '../server/uploads/')); // Set the destination for file uploads
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname)); // Set the file name
  }
});

const upload = multer({ storage });

// Middleware to handle multiple file uploads to Cloudinary
const uploadMiddleware = (req, res, next) => {
  const uploadMultiple = upload.array('chefProfiles', 10); // Adjust the field name and limit if necessary
  uploadMultiple(req, res, async (err) => {
    if (err) {
      return res.status(400).send('File upload failed');
    }

    if (!req.files || req.files.length === 0) {
      return res.status(400).send('No files uploaded');
    }

    try {
      const uploadPromises = req.files.map(async (file) => {
        const filePath = file.path;

        // Upload each file to Cloudinary
        const cloudinaryResponse = await cloudinary.uploader.upload(filePath, {
          folder: 'MyPhotosFolder', // Replace with the desired folder name
        });

        fs.unlinkSync(filePath); // Remove local file after upload

        return cloudinaryResponse.secure_url; // Return the public URL
      });

      // Wait for all files to be uploaded
      const uploadedUrls = await Promise.all(uploadPromises);

      // Store all public URLs in the request object for later use
      req.uploadedFiles = uploadedUrls;

      next(); // Proceed to the next middleware or route handler
    } catch (error) {
      console.error('Error uploading files to Cloudinary:', error);
      res.status(500).send('Failed to upload files');
    }
  });
};

module.exports = uploadMiddleware;
