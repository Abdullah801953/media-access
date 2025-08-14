import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { google } from "googleapis";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import path from "path";
import { fileURLToPath } from "url";
import sharp from "sharp";
import { connectDB } from "./utils/db.js";
import helmet from "helmet";
import morgan from "morgan";
import stream from "stream";
import ffmpegInstaller from "@ffmpeg-installer/ffmpeg";
import ffmpeg from "fluent-ffmpeg";

ffmpeg.setFfmpegPath(ffmpegInstaller.path);

import User from "./model/user.schema.js";
import Admin from "./model/admin.schema.js";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Enhanced CORS configuration
app.use(
  cors({
    origin: "*",
    methods: ["GET", "OPTIONS"],
    allowedHeaders: ["Content-Type"],
  })
);

app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
  })
);

app.use(morgan("dev"));

app.use(express.json()); // Parse JSON
app.use(express.urlencoded({ extended: true }));

// Health check endpoint
app.get("/health", (_, res) => {
  res.status(200).json({
    status: "healthy",
    timestamp: new Date().toISOString(),
  });
});

// Google Drive Auth with error handling
let drive;
try {
  const auth = new google.auth.GoogleAuth({
    keyFile: path.join(__dirname, "service-account.json"),
    scopes: ["https://www.googleapis.com/auth/drive.readonly"],
  });
  drive = google.drive({ version: "v3", auth });
  console.log("Google Drive API authenticated successfully");
} catch (authError) {
  console.error("Authentication failed:", authError);
  process.exit(1);
}

app.get("/api/drive-folder", async (_, res) => {
  try {
    if (!process.env.FOLDER_ID) {
      throw new Error("FOLDER_ID environment variable not set");
    }

    console.log(`Fetching files from folder: ${process.env.FOLDER_ID}`);

    // Get all files recursively
    let allFiles = [];
    let pageToken = null;

    do {
      const response = await drive.files.list({
        q: `'${process.env.FOLDER_ID}' in parents and trashed = false`,
        fields:
          "nextPageToken, files(id, name, mimeType, webViewLink, iconLink, modifiedTime)",
        orderBy: "name",
        pageSize: 1000, // Maximum allowed
        pageToken: pageToken,
      });

      allFiles = allFiles.concat(response.data.files || []);
      pageToken = response.data.nextPageToken;
    } while (pageToken);

    console.log(`Found ${allFiles.length} files`);

    // Filter for images only on the client side if needed
    res.json(allFiles);
  } catch (error) {
    console.error("Error fetching files:", error.message);
    res.status(500).json({
      error: "Failed to fetch files",
      details: error.message,
    });
  }
});

// /api/drive-folder/:folderId endpoint
app.get("/api/drive-folder/:folderId", async (req, res) => {
  try {
    const folderId = req.params.folderId;
    let allFiles = [];
    let pageToken = null;

    do {
      const response = await drive.files.list({
        q: `'${folderId}' in parents and trashed = false`,
        fields:
          "nextPageToken, files(id, name, mimeType, webViewLink, iconLink, modifiedTime, size)",
        orderBy: "name",
        pageSize: 1000,
        pageToken: pageToken,
      });

      const filesWithFolderFlag = (response.data.files || []).map((f) => ({
        ...f,
        isFolder: f.mimeType === "application/vnd.google-apps.folder",
      }));

      allFiles = allFiles.concat(filesWithFolderFlag);
      pageToken = response.data.nextPageToken;
    } while (pageToken);

    res.json(allFiles);
  } catch (error) {
    console.error("Error fetching folder contents:", error.message);
    res.status(500).json({ error: error.message });
  }
});

// Watermark endpoint with better error handling
app.get("/api/file/:id/watermark", async (req, res) => {
  const fileId = req.params.id;
  console.log(`Processing watermark for file: ${fileId}`);

  try {
    // Pehle file ka metadata lo
    const fileMeta = await drive.files.get({
      fileId,
      fields: "mimeType, name",
    });

    const mimeType = fileMeta.data.mimeType;
    console.log(`File MIME type: ${mimeType}`);

    // Download file
    const { data } = await drive.files.get(
      { fileId, alt: "media" },
      { responseType: "arraybuffer" }
    );

    const fileBuffer = Buffer.from(data);

    if (mimeType.startsWith("image/")) {
      // ✅ Image watermark
      const watermarkedImage = await applyWatermark(fileBuffer);
      res.set("Content-Type", mimeType);
      res.send(watermarkedImage);
    } else if (mimeType.startsWith("video/")) {
      // ✅ Video watermark using ffmpeg
      const watermarkedVideo = await applyVideoWatermark(fileBuffer);
      res.set("Content-Type", mimeType);
      res.send(watermarkedVideo);
    } else {
      res.status(400).json({ error: "Unsupported file type" });
    }
  } catch (error) {
    console.error(`Watermark failed for ${fileId}:`, error.message);
    res.status(500).json({
      error: "Error adding watermark",
      fileId,
      details: error.message,
    });
  }
});

// image watermark function
async function applyWatermark(imageBuffer) {
  try {
    const watermarkPath = path.resolve(__dirname, "watermarks/logo2.png");

    // Verify watermark exists
    await sharp(watermarkPath).metadata();

    const metadata = await sharp(imageBuffer).metadata();
    console.log(
      `Original image dimensions: ${metadata.width}x${metadata.height}`
    );

    // Watermark resize: exactly cover the whole image
    const watermarkBuffer = await sharp(watermarkPath)
      .resize(metadata.width, metadata.height, {
        fit: "cover", // completely fill the image area
        withoutEnlargement: true,
      })
      .png() // ensure transparency is preserved
      .toBuffer();

    // Apply single centered watermark
    return await sharp(imageBuffer)
      .composite([
        {
          input: watermarkBuffer,
          gravity: "center",
          blend: "over",
          opacity: 0.3,
        },
      ])
      .jpeg({ quality: 80 })
      .toBuffer();
  } catch (err) {
    console.error("Watermark processing failed:", err.message);
    throw err;
  }
}

// Video watermark function
function applyVideoWatermark(videoBuffer) {
  return new Promise((resolve, reject) => {
    const inputStream = new stream.PassThrough();
    inputStream.end(videoBuffer);

    const outputStream = new stream.PassThrough();
    const chunks = [];

    ffmpeg(inputStream)
      .input(path.resolve(__dirname, "watermarks/logo.png")) // watermark image
      .complexFilter(["overlay=10:10"]) // position of watermark
      .format("mp4")
      .outputOptions(["-movflags frag_keyframe+empty_moov"]) // streaming friendly
      .on("error", (err) => {
        console.error("FFmpeg error:", err);
        reject(err);
      })
      .on("end", () => {
        console.log("✅ Video watermarking complete");
        resolve(Buffer.concat(chunks));
      })
      .pipe(outputStream);

    outputStream.on("data", (chunk) => chunks.push(chunk));
  });
}

// Generate JWT token
app.post("/api/generate-token", async (req, res) => {
  try {
    const { name, email, message, fileId } = req.body;

    if (!name || !email || !fileId) {
      return res.status(400).json({ error: "Name, email and fileId are required" });
    }

    // Validate email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: "Please provide a valid email address" });
    }

    // Always create a new user
    const user = new User({
      name: name.trim(),
      email: email.trim(),
      message: message ? message.trim() : "",
      tokens: []
    });

    await user.save();

    // Generate a unique JWT token for this user and file
    const token = jwt.sign(
      { userId: user._id, email: user.email, fileId },
      process.env.JWT_SECRET,
      { expiresIn: "30d" }
    );

    // Get file info from Google Drive
    const fileInfo = await drive.files.get({
      fileId,
      fields: "name,mimeType"
    });

    // Add token to user
    user.tokens.push({
      token,
      fileId,
      fileName: fileInfo.data.name,
      fileType: fileInfo.data.mimeType.startsWith("image/")
        ? "image"
        : fileInfo.data.mimeType.startsWith("video/")
        ? "video"
        : fileInfo.data.mimeType.includes("folder")
        ? "folder"
        : "file"
    });

    // Save user with token
    await user.save();

    res.json({
      success: true,
      token,
      fileId,
      userId: user._id
    });
  } catch (err) {
    console.error("Error generating token:", err);
    res.status(500).json({ error: "Internal server error", details: err.message });
  }
});

// Verify token and serve clean file
app.get("/api/download/:id", async (req, res) => {
  try {
    const token = req.query.token;
    const fileId = req.params.id;

    if (!token) {
      return res.status(401).json({ error: "Token required" });
    }

    // Verify JWT
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // STRICT FILE MATCHING - no more general tokens
    if (decoded.fileId !== fileId) {
      return res.status(403).json({
        error: "This token is not valid for the requested file",
        validForFile: decoded.fileId,
      });
    }

    // Verify token exists in database for this specific file
    const user = await User.findOne({
      "tokens.token": token,
      "tokens.fileId": fileId,
    });

    if (!user) {
      return res.status(403).json({ error: "Token not found or invalid" });
    }

    // Serve the file
    const { data } = await drive.files.get(
      { fileId, alt: "media" },
      { responseType: "stream" }
    );

    data.pipe(res);
  } catch (err) {
    console.error("Download error:", err);
    if (err.name === "JsonWebTokenError") {
      return res.status(401).json({ error: "Invalid token" });
    }
    res.status(500).json({ error: "Internal server error" });
  }
});

// Admin routes
app.get("/api/users", async (req, res) => {
  try {
    // Add admin authentication here
    const users = await User.find({});
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/file-info/:id", async (req, res) => {
  console.log("Requested file info for:", req.params.id);
  try {
    const fileId = req.params.id;
    const { data } = await drive.files.get({
      fileId,
      fields: "id,name,mimeType,webViewLink,iconLink,modifiedTime,size",
    });
    res.json(data);
  } catch (err) {
    console.error("Google Drive API error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/token-info/:token", async (req, res) => {
  try {
    const token = req.params.token;
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Find user and token in database
    const user = await User.findOne({
      _id: decoded.userId,
      "tokens.token": token,
    });

    if (!user) {
      return res.status(404).json({ error: "Token not found" });
    }

    const tokenData = user.tokens.find((t) => t.token === token);

    res.json({
      valid: true,
      user: {
        name: user.name,
        email: user.email,
      },
      file: tokenData.fileId
        ? {
            id: tokenData.fileId,
            name: tokenData.fileName,
            type: tokenData.fileType,
          }
        : null,
      purpose: decoded.purpose,
    });
  } catch (err) {
    res.status(401).json({ error: "Invalid token" });
  }
});

app.delete("/api/revoke-token/:fileId", async (req, res) => {
  try {
    const { fileId } = req.params;

    await User.updateMany({}, { $pull: { tokens: { fileId } } });

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/tokens-for-file/:fileId", async (req, res) => {
  try {
    const { fileId } = req.params;

    // Find all users who have tokens for this file
    const users = await User.find({ "tokens.fileId": fileId });

    if (!users || users.length === 0) {
      return res.status(404).json({ error: "No tokens found for this file" });
    }

    // Map to extract all token data
    const allTokens = users.flatMap(user =>
      user.tokens.filter(t => t.fileId === fileId).map(t => ({
        token: t.token,
        userName: user.name,
        userEmail: user.email,
        fileName: t.fileName,
        fileType: t.fileType
      }))
    );

    res.json(allTokens);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/admin/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    console.log(`Admin login attempt for: ${email} ${password}`);

    // 1. Check if admin exists
    const admin = await Admin.findOne({ email });
    if (!admin) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    // 2. Verify password
    const isMatch = await bcrypt.compare(password, admin.password);
    if (!isMatch) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    // 3. Generate token
    const token = jwt.sign(
      { id: admin._id, role: "admin" },
      process.env.JWT_SECRET
    );

    res.json({ token, email: admin.email });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/admin/users", async (req, res) => {
  try {
    // Verify admin token
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) {
      return res.status(401).json({ error: "Not authorized" });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.role !== "admin") {
      return res.status(403).json({ error: "Admin access required" });
    }

    const users = await User.find({});
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`Test endpoint: http://localhost:${PORT}/health`);
  console.log(
    `Drive folder endpoint: http://localhost:${PORT}/api/drive-folder`
  );
  connectDB();
});
