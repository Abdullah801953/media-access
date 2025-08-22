import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { google } from "googleapis";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import path from "path";
import { Readable } from "stream";
import { fileURLToPath } from "url";
import sharp from "sharp";
import { connectDB } from "./utils/db.js";
import morgan from "morgan";
import stream from "stream";
import ffmpegInstaller from "@ffmpeg-installer/ffmpeg";
import ffmpeg from "fluent-ffmpeg";
import archiver from "archiver";
import fs from "fs";
import { pipeline } from "stream";
import { promisify } from "util";

const streamPipeline = promisify(pipeline);

ffmpeg.setFfmpegPath(ffmpegInstaller.path);

import User from "./model/user.schema.js";
import Admin from "./model/admin.schema.js";
import { file } from "googleapis/build/src/apis/file/index.js";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

const watermarkPath = path.resolve(__dirname, "watermarks", "logo.png");

const allowedOrigins = [
  "http://localhost:5173",
  "http://localhost:5174",
  "https://media-access.vercel.app",
  "https://media-access-3pjy.vercel.app",
  "https://portfolio.oneshootproduction.in",
  "https://admin.oneshootproduction.in"
];

// Verify watermark exists before starting server
if (!fs.existsSync(watermarkPath)) {
  console.error(`Watermark not found at: ${watermarkPath}`);
  console.error(
    "Please create a watermarks folder with logo.png in your project root"
  );
  process.exit(1);
}

app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true, 
  })
);

app.use(morgan("dev"));

app.use(express.json());
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
          "nextPageToken, files(id, name, mimeType, size, webViewLink, iconLink, modifiedTime, parents)",
        orderBy: "name",
        pageSize: 1000,
        pageToken: pageToken,
      });

      allFiles = allFiles.concat(response.data.files || []);
      pageToken = response.data.nextPageToken;
    } while (pageToken);

    console.log(`Found ${allFiles.length} files`);

    // For folders, we need to count their contents
    const folders = allFiles.filter(file => file.mimeType === "application/vnd.google-apps.folder");
    
    // Add file count information for each folder
    for (const folder of folders) {
      let folderFiles = [];
      let folderPageToken = null;
      
      do {
        const folderResponse = await drive.files.list({
          q: `'${folder.id}' in parents and trashed = false`,
          fields: "nextPageToken, files(id, mimeType)",
          pageSize: 1000,
          pageToken: folderPageToken,
        });
        
        folderFiles = folderFiles.concat(folderResponse.data.files || []);
        folderPageToken = folderResponse.data.nextPageToken;
      } while (folderPageToken);
      
      // Add folder metadata to the folder object
      folder.folderInfo = {
        totalFiles: folderFiles.length,
        imageCount: folderFiles.filter(f => f.mimeType.startsWith("image/")).length,
        videoCount: folderFiles.filter(f => f.mimeType.startsWith("video/")).length
      };
    }

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


app.get("/api/folder-size/:folderId", async (req, res) => {
  const folderId = req.params.folderId;
  
  try {
    // Recursively get all files in folder and subfolders
    const getAllFilesRecursive = async (currentFolderId) => {
      const filesList = await drive.files.list({
        q: `'${currentFolderId}' in parents and trashed=false`,
        fields: "files(id, name, mimeType, size)",
        pageSize: 1000,
      });

      let totalSize = 0;
      
      for (const item of filesList.data.files) {
        if (item.mimeType === 'application/vnd.google-apps.folder') {
          // Recursively get subfolder size
          const subFolderSize = await getAllFilesRecursive(item.id);
          totalSize += subFolderSize;
        } else if (item.size) {
          // Add file size
          totalSize += parseInt(item.size);
        }
      }
      
      return totalSize;
    };

    const totalSize = await getAllFilesRecursive(folderId);
    
    res.json({ totalSize });
  } catch (error) {
    console.error(`Error getting folder size for ${folderId}:`, error);
    res.status(500).json({ error: "Failed to calculate folder size" });
  }
});

// image watermark function
async function applyWatermark(imageBuffer) {
  try {
    const watermarkPath = path.resolve(__dirname, "watermarks/logo2.png");

    // Verify watermark exists
    await sharp(watermarkPath).metadata();

    const metadata = await sharp(imageBuffer).metadata();
    
    // Watermark resize: exactly cover the whole image
    const watermarkBuffer = await sharp(watermarkPath)
      .resize(metadata.width, metadata.height, {
        fit: "inside",
      })
      .png()
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

    const chunks = [];
    const watermarkPath = path.resolve(__dirname, "watermarks/logo2.png");

    ffmpeg(inputStream)
      .input(watermarkPath)
      .complexFilter([
        {
          filter: "overlay",
          options: {
            x: "(main_w-overlay_w)/2", // center horizontally
            y: "(main_h-overlay_h)/2", // center vertically
          },
        },
      ])
      .videoCodec("libx264")
      .audioCodec("copy")
      .outputOptions([
        "-movflags frag_keyframe+empty_moov",
        "-preset ultrafast",
        "-crf 30",
        "-pix_fmt yuv420p",
        "-threads 0",
      ])
      .format("mp4")
      .on("error", (err) => {
        console.error("FFmpeg video watermark error:", err.message);
        reject(err);
      })
      .on("end", () => {
        resolve(Buffer.concat(chunks));
      })
      .pipe(
        new stream.PassThrough().on("data", (chunk) => chunks.push(chunk))
      );
  });
}

app.get("/api/file/:id/watermark", async (req, res) => {
  const fileId = req.params.id;
  console.log(`Processing file: ${fileId}`);

  try {
    // 1️⃣ Get file metadata from Google Drive
    const fileMeta = await drive.files.get({
      fileId,
      fields: "mimeType, name, size",
    });

    const mimeType = fileMeta.data.mimeType;
    const fileName = fileMeta.data.name;

    res.setHeader(
      "Content-Disposition",
      `inline; filename="${fileName}"`
    );
    res.setHeader("Cache-Control", "no-cache");

    // ===== IMAGE FILE ===== (Apply watermark)
    if (mimeType.startsWith("image/")) {
      const { data } = await drive.files.get(
        { fileId, alt: "media" },
        { responseType: "arraybuffer" }
      );
      const processedBuffer = await applyWatermark(Buffer.from(data));
      res.setHeader("Content-Type", mimeType);
      res.setHeader("Content-Length", processedBuffer.length);
      return res.send(processedBuffer);
    }

    // ===== VIDEO FILE ===== (Stream directly without watermark)
    if (mimeType.startsWith("video/")) {
      const { data: driveStream } = await drive.files.get(
        { fileId, alt: "media" },
        { responseType: "stream" }
      );

      res.setHeader("Content-Type", mimeType);
      
      // Pipe the video stream directly to response
      driveStream.pipe(res);
      
      driveStream.on('error', (err) => {
        console.error("Drive stream error:", err);
        if (!res.headersSent) {
          res.status(500).json({ error: "Failed to stream video", details: err.message });
        }
      });

      return;
    }

    // ===== UNSUPPORTED FILE =====
    return res.status(400).json({ error: "Unsupported file type" });

  } catch (error) {
    console.error(`File processing failed for ${fileId}:`, error.message);
    if (!res.headersSent) {
      res.status(500).json({
        error: "Error processing file",
        fileId,
        details: error.message,
      });
    }
  }
});

// Generate JWT token
app.post("/api/generate-token", async (req, res) => {
  try {
    const { name, email, message, fileId } = req.body;

    if (!name || !email || !fileId) {
      return res
        .status(400)
        .json({ error: "Name, email and fileId are required" });
    }

    // Validate email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res
        .status(400)
        .json({ error: "Please provide a valid email address" });
    }

    // Check if user already exists
    let user = await User.findOne({ email: email.trim() });

    // Get file info from Google Drive
    const fileInfo = await drive.files.get({
      fileId,
      fields: "name,mimeType",
    });

    const fileType = fileInfo.data.mimeType.startsWith("image/")
      ? "image"
      : fileInfo.data.mimeType.startsWith("video/")
      ? "video"
      : fileInfo.data.mimeType.includes("folder")
      ? "folder"
      : "file";

    if (user) {
      // Check if token for same fileId already exists
      const existingToken = user.tokens.find((t) => t.fileId === fileId);
      if (existingToken) {
        return res
          .status(400)
          .json({ error: "Token already exists for this file and user" });
      }

      // Generate new token for this file
      const token = jwt.sign(
        { userId: user._id, email: user.email, fileId, fileType },
        process.env.JWT_SECRET
      );

      // Push new token
      user.tokens.push({
        token,
        fileId,
        fileName: fileInfo.data.name,
        fileType,
      });

      await user.save();

      return res.json({
        success: true,
        token,
        fileId,
        fileType,
        userId: user._id,
      });
    } else {
      // Create new user and token
      const token = jwt.sign(
        { email: email.trim(), fileId, fileType },
        process.env.JWT_SECRET
      );

      user = new User({
        name: name.trim(),
        email: email.trim(),
        message: message ? message.trim() : "",
        tokens: [
          {
            token,
            fileId,
            fileName: fileInfo.data.name,
            fileType,
          },
        ],
      });

      await user.save();

      return res.json({
        success: true,
        token,
        fileId,
        fileType,
        userId: user._id,
      });
    }
  } catch (err) {
    console.error("Error generating token:", err);
    res
      .status(500)
      .json({ error: "Internal server error", details: err.message });
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

    // Match token with file
    if (decoded.fileId !== fileId) {
      return res.status(403).json({
        error: "Token not valid for this file",
        validForFile: decoded.fileId,
      });
    }

    // Check DB token
    const user = await User.findOne({
      "tokens.token": token,
      "tokens.fileId": fileId,
    });
    if (!user) {
      return res.status(403).json({ error: "Token not found or invalid" });
    }

    // ✅ Get file metadata (for correct filename & size)
    const fileMeta = await drive.files.get({
      fileId,
      fields: "name, size, mimeType",
    });

    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${fileMeta.data.name}"`
    );
    res.setHeader(
      "Content-Type",
      fileMeta.data.mimeType || "application/octet-stream"
    );
    res.setHeader("Content-Length", fileMeta.data.size);

    // ✅ Stream file directly to client
    const { data } = await drive.files.get(
      { fileId, alt: "media" },
      { responseType: "stream" }
    );

    data.on("error", (err) => {
      console.error("Stream error:", err);
      if (!res.headersSent) {
        res.status(500).json({ error: "File streaming failed" });
      }
    });

    data.pipe(res);
  } catch (err) {
    console.error("Download error:", err);
    if (err.name === "JsonWebTokenError") {
      return res.status(401).json({ error: "Invalid token" });
    }
    res.status(500).json({ error: "Internal server error" });
  }
});

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
    const allTokens = users.flatMap((user) =>
      user.tokens
        .filter((t) => t.fileId === fileId)
        .map((t) => ({
          token: t.token,
          userName: user.name,
          userEmail: user.email,
          fileName: t.fileName,
          fileType: t.fileType,
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

app.get("/api/folder/:id/watermark-zip", async (req, res) => {
  const folderId = req.params.id;

  try {
    // 1️⃣ Get all files from the folder
    const filesList = await drive.files.list({
      q: `'${folderId}' in parents and trashed=false`,
      fields: "files(id, name, mimeType, size)",
      pageSize: 1000,
    });

    if (!filesList.data.files.length) {
      return res.status(404).json({ error: "No files found in folder" });
    }

    // 2️⃣ Prepare ZIP response
    const zipFileName = `folder_${folderId}_watermarked.zip`;
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${zipFileName}"`
    );
    res.setHeader("Content-Type", "application/zip");

    const archive = archiver("zip", { 
      zlib: { level: 9 },
      highWaterMark: 1024 * 1024 // 1MB buffer
    });
    
    // Handle archive errors
    archive.on('error', (err) => {
      console.error('Archive error:', err);
      if (!res.headersSent) {
        res.status(500).json({ error: "Archive creation failed" });
      }
    });
    
    archive.pipe(res);

    // 3️⃣ Recursively get all files from folder and subfolders
    const getAllFiles = async (currentFolderId, currentPath = '') => {
      const filesList = await drive.files.list({
        q: `'${currentFolderId}' in parents and trashed=false`,
        fields: "files(id, name, mimeType, size)",
        pageSize: 1000,
      });

      const allFiles = [];
      
      for (const item of filesList.data.files) {
        if (item.mimeType === 'application/vnd.google-apps.folder') {
          // It's a folder - recursively get its contents
          console.log(`Processing folder: ${item.name}`);
          const subFiles = await getAllFiles(item.id, `${currentPath}${item.name}/`);
          allFiles.push(...subFiles);
        } else {
          // It's a file - add to list
          allFiles.push({
            ...item,
            path: currentPath
          });
        }
      }
      
      return allFiles;
    };

    // Get all files recursively
    const allFiles = await getAllFiles(folderId);
    console.log(`Found ${allFiles.length} files to process`);

    if (allFiles.length === 0) {
      archive.finalize();
      return;
    }

    // 4️⃣ Process files with limited concurrency
    const CONCURRENCY_LIMIT = 3;
    let processedCount = 0;

    const processFile = async (file) => {
      try {
        console.log(`Processing file: ${file.path}${file.name} (${file.mimeType})`);
        
        // Skip files that are too large to process in memory
        if (file.size > 50 * 1024 * 1024) {
          console.log(`Skipping large file: ${file.name}`);
          return null;
        }

        const { data } = await drive.files.get(
          { fileId: file.id, alt: "media" },
          { responseType: "arraybuffer" }
        );

        const fileBuffer = Buffer.from(data);
        let processedBuffer;

        if (file.mimeType.startsWith("image/")) {
          processedBuffer = await applyWatermark(fileBuffer);
        } else if (file.mimeType.startsWith("video/")) {
          // Skip watermarking for videos to avoid memory issues
          processedBuffer = fileBuffer;
        } else {
          processedBuffer = fileBuffer; 
        }

        return {
          buffer: processedBuffer,
          name: `${file.path}${file.name}`
        };
      } catch (fileError) {
        console.error(`Error processing ${file.path}${file.name}:`, fileError.message);
        return null;
      } finally {
        processedCount++;
        console.log(`Processed ${processedCount}/${allFiles.length} files`);
      }
    };

    // Process files in batches
    const processInBatches = async (files, concurrency) => {
      for (let i = 0; i < files.length; i += concurrency) {
        const batch = files.slice(i, i + concurrency);
        const batchResults = await Promise.all(batch.map(processFile));
        
        // Add processed files to archive
        for (const result of batchResults) {
          if (result) {
            archive.append(result.buffer, { name: result.name });
          }
        }
      }
    };

    // Process all files
    await processInBatches(allFiles, CONCURRENCY_LIMIT);

    // 5️⃣ Finalize ZIP
    archive.finalize();
    
    archive.on('progress', (progress) => {
      console.log(`ZIP progress: ${progress.entries.processed} files`);
    });
    
    archive.on('end', () => {
      console.log('ZIP creation completed');
    });

  } catch (error) {
    console.error(`ZIP watermark failed for ${folderId}:`, error.message);
    if (!res.headersSent) {
      res.status(500).json({
        error: "Error creating watermarked ZIP",
        details: error.message,
      });
    }
  }
});

app.post("/api/verify-folder-token", async (req, res) => {
  try {
    const { token, fileId } = req.body;

    // Validate input
    if (!token || !fileId) {
      return res.status(400).json({
        valid: false,
        error: "Both token and folder ID are required",
      });
    }

    // Verify the JWT token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Check if token matches the requested folder
    if (decoded.fileId !== fileId) {
      return res.status(403).json({
        valid: false,
        error: "Token is not valid for this folder",
        validForFolder: decoded.fileId,
      });
    }

    // Check if token is for a folder
    if (decoded.fileType !== "folder") {
      return res.status(403).json({
        valid: false,
        error: "Token is not valid for folders",
      });
    }

    // Verify token exists in database for this specific folder
    const user = await User.findOne({
      "tokens.token": token,
      "tokens.fileId": fileId,
      "tokens.fileType": "folder",
    });

    if (!user) {
      return res.status(403).json({
        valid: false,
        error: "Token not found or invalid",
      });
    }

    // If all checks pass
    res.json({
      valid: true,
      message: "Token verified successfully",
      tokenData: {
        email: decoded.email,
        fileId: decoded.fileId,
        fileType: decoded.fileType,
      },
    });
  } catch (err) {
    console.error("Token verification error:", err);

    if (err.name === "JsonWebTokenError") {
      return res.status(401).json({
        valid: false,
        error: "Invalid token",
      });
    }

    if (err.name === "TokenExpiredError") {
      return res.status(401).json({
        valid: false,
        error: "Token has expired",
      });
    }

    res.status(500).json({
      valid: false,
      error: "Internal server error during verification",
    });
  }
});

app.get("/api/folder/:id/clean-zip", async (req, res) => {
  const folderId = req.params.id;
  console.log(`Processing clean ZIP for folder: ${folderId}`);

  try {
    // Recursively get all files
    const getAllFiles = async (currentFolderId, currentPath = '') => {
      const filesList = await drive.files.list({
        q: `'${currentFolderId}' in parents and trashed=false`,
        fields: "files(id, name, mimeType, size)",
        pageSize: 1000,
      });

      const allFiles = [];
      
      for (const item of filesList.data.files) {
        if (item.mimeType === 'application/vnd.google-apps.folder') {
          const subFiles = await getAllFiles(item.id, `${currentPath}${item.name}/`);
          allFiles.push(...subFiles);
        } else {
          allFiles.push({
            ...item,
            path: currentPath
          });
        }
      }
      
      return allFiles;
    };

    const allFiles = await getAllFiles(folderId);
    
    if (allFiles.length === 0) {
      return res.status(404).json({ error: "No files found in folder" });
    }

    // Prepare ZIP response
    const zipFileName = `folder_${folderId}_clean.zip`;
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${zipFileName}"`
    );
    res.setHeader("Content-Type", "application/zip");

    const archive = archiver("zip", {
      zlib: { level: 9 },
      highWaterMark: 1024 * 1024,
    });

    archive.on("error", (err) => {
      console.error("Archive error:", err);
      if (!res.headersSent) {
        res.status(500).json({ error: "Archive creation failed" });
      }
    });

    archive.pipe(res);

    // Add files using streams
    for (const file of allFiles) {
      try {
        const fileStream = await drive.files.get(
          { fileId: file.id, alt: "media" },
          { responseType: "stream" }
        );

        archive.append(fileStream.data, { name: `${file.path}${file.name}` });
      } catch (fileError) {
        console.error(`Error adding ${file.name}:`, fileError.message);
      }
    }

    archive.finalize();

  } catch (error) {
    console.error(`Clean ZIP failed for ${folderId}:`, error.message);
    if (!res.headersSent) {
      res.status(500).json({
        error: "Error creating clean ZIP",
        details: error.message,
      });
    }
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