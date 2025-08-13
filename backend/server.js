import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { google } from "googleapis";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import bodyParser from "body-parser";
import path from "path";
import { fileURLToPath } from "url";
import sharp from "sharp";
import { connectDB } from "./utils/db.js";

import User from "./model/user.schema.js";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const TOKEN_EXPIRY = "1d";

const app = express();

// Enhanced CORS configuration
app.use(
  cors({
    origin: "*",
    methods: ["GET", "OPTIONS"],
    allowedHeaders: ["Content-Type"],
  })
);

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

// In your server.js, modify the drive-folder endpoint
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

      allFiles = allFiles.concat(response.data.files || []);
      pageToken = response.data.nextPageToken;
    } while (pageToken);

    res.json(allFiles);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Watermark endpoint with better error handling
app.get("/api/file/:id/watermark", async (req, res) => {
  const fileId = req.params.id;
  console.log(`Processing watermark for file: ${fileId}`);

  try {
    // Download file from Google Drive
    const { data } = await drive.files.get(
      { fileId, alt: "media" },
      { responseType: "arraybuffer" }
    );

    const imageBuffer = Buffer.from(data);
    console.log(`Downloaded file ${fileId}, size: ${imageBuffer.length} bytes`);

    // Apply watermark
    const watermarkedImage = await applyWatermark(imageBuffer);
    console.log(`Successfully watermarked file ${fileId}`);

    res.set("Content-Type", "image/jpeg");
    res.send(watermarkedImage);
  } catch (error) {
    console.error(`Watermark failed for ${fileId}:`, error.message);
    res.status(500).json({
      error: "Error adding watermark",
      fileId,
      details: error.message,
    });
  }
});

// Improved watermark function
async function applyWatermark(imageBuffer) {
  try {
    const watermarkPath = path.resolve(__dirname, "watermarks/logo.png");

    // Verify watermark exists
    try {
      await sharp(watermarkPath).metadata();
    } catch (err) {
      throw new Error(`Watermark file not found at ${watermarkPath}`);
    }

    const metadata = await sharp(imageBuffer).metadata();
    console.log(
      `Original image dimensions: ${metadata.width}x${metadata.height}`
    );

    // Resize watermark
    const watermarkSize = Math.max(
      50, // Minimum size
      Math.round(metadata.width * 0.1) // 10% of width
    );

    const watermarkBuffer = await sharp(watermarkPath)
      .resize(watermarkSize, watermarkSize, {
        fit: "inside",
        withoutEnlargement: true,
      })
      .toBuffer();

    // Generate positions
    const watermarks = Array.from({ length: 5 }).map(() => ({
      input: watermarkBuffer,
      top: Math.floor(Math.random() * (metadata.height - watermarkSize)),
      left: Math.floor(Math.random() * (metadata.width - watermarkSize)),
      blend: "over",
      opacity: 0.3,
    }));

    return await sharp(imageBuffer)
      .composite(watermarks)
      .jpeg({ quality: 80 })
      .toBuffer();
  } catch (err) {
    console.error("Watermark processing failed:", err.message);
    throw err;
  }
}

// Generate JWT token
app.post("/api/generate-token", async (req, res) => {
  try {
    const { name, email, message, fileId } = req.body;

    // Validate required fields
    if (!name || !email || !fileId) { // Require fileId now
      return res.status(400).json({ 
        error: "Name, email and fileId are required" 
      });
    }

    // Check if token already exists for this file
    const existingUser = await User.findOne({
      "tokens.fileId": fileId
    });

    if (existingUser) {
      const existingToken = existingUser.tokens.find(t => t.fileId === fileId);
      if (existingToken) {
        return res.status(400).json({ 
          error: "Token already exists for this file",
          existingToken: existingToken.token
        });
      }
    }

    // Create or update user
    let user = await User.findOne({ email });
    if (!user) {
      user = new User({ 
        name: name.trim(), 
        email: email.trim(), 
        message: message ? message.trim() : "", 
        tokens: [] 
      });
    }

    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days expiry

    // Generate JWT token - fileId is now required
    const token = jwt.sign(
      {
        userId: user._id,
        email: user.email,
        fileId: fileId, // No more null allowed
        expiresAt
      },
      process.env.JWT_SECRET,
      { expiresIn: "30d" }
    );

    // Get file info from Google Drive
    const fileInfo = await drive.files.get({
      fileId,
      fields: "name,mimeType"
    });

    // Add token to user
    const tokenData = {
      token,
      expiresAt,
      fileId,
      fileName: fileInfo.data.name,
      fileType: fileInfo.data.mimeType.startsWith("image/") ? "image" : 
               fileInfo.data.mimeType.startsWith("video/") ? "video" :
               fileInfo.data.mimeType.includes("folder") ? "folder" : "file"
    };

    user.tokens.push(tokenData);
    await user.save();

    res.json({ 
      success: true, 
      token,
      expiresAt,
      fileId
    });

  } catch (err) {
    console.error("Error generating token:", err);
    res.status(500).json({ 
      error: "Failed to generate token",
      details: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
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

    // Check expiration
    if (new Date(decoded.expiresAt) < new Date()) {
      return res.status(403).json({ error: "Token has expired" });
    }

    // STRICT FILE MATCHING - no more general tokens
    if (decoded.fileId !== fileId) {
      return res.status(403).json({
        error: "This token is not valid for the requested file",
        validForFile: decoded.fileId
      });
    }

    // Verify token exists in database for this specific file
    const user = await User.findOne({
      "tokens.token": token,
      "tokens.fileId": fileId
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
    console.error('Download error:', err);
    if (err.name === 'JsonWebTokenError') {
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
      expiresAt: tokenData.expiresAt,
      purpose: decoded.purpose,
    });
  } catch (err) {
    res.status(401).json({ error: "Invalid token" });
  }
});

app.delete("/api/revoke-token/:fileId", async (req, res) => {
  try {
    const { fileId } = req.params;
    
    await User.updateMany(
      {},
      { $pull: { tokens: { fileId } } }
    );
    
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/token-for-file/:fileId", async (req, res) => {
  try {
    const { fileId } = req.params;
    
    const user = await User.findOne({
      "tokens.fileId": fileId
    });
    
    if (!user) {
      return res.status(404).json({ error: "No token found for this file" });
    }
    
    const tokenData = user.tokens.find(t => t.fileId === fileId);
    res.json(tokenData);
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
