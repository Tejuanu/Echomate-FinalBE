var express = require("express");
const AWS = require("aws-sdk");
const multer = require("multer");
const { v4: uuid } = require("uuid");
require("dotenv").config();

const keys = {
  accessKeyId: process.env.AWS_ACCESS_KEY,
  secretAccessKey: process.env.AWS_SECRET_KEY,
};

const s3 = new AWS.S3(keys)

const upload = multer({
  storage: multer.memoryStorage(), // Store data in memory for buffer handling
  limits: { fileSize: 5 * 1024 * 1024 }, // Optional: Limit file size (5 MB here)
});
var router = express.Router();

router.get('/upload', function(req, res, next) {
  res.send("Hello World")
})

/* GET home page. */
router.post("/upload", upload.single("file"), async (req, res) => {
  try {
    console.log(req.file)
    if (!req.file) {
      return res.status(400).send("No file uploaded");
    }

    const { buffer, originalname } = req.file; // Extract buffer and original filename
    const params = {
      Bucket: "echo-mate",
      Key: `${uuid()}-${originalname}`, // Generate unique filename
      Body: buffer,
      ACL: "public-read", // Optional: Set access permissions (public in this case)
    };

    const uploadResult = await s3.upload(params).promise();

    res.status(200).json({
      message: "File uploaded successfully",
      fileUrl: uploadResult.Location,
    });
  } catch (err) {
    console.error(err);
    res.status(500).send(err.message);
  }
});

module.exports = router;
