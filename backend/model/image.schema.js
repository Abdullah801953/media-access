import mongoose from "mongoose";

// Image Schema
const ImageSchema = new mongoose.Schema({
  name: String,
  path: String,
  price: Number,
  watermarkPath: String, // Path to watermarked version
});

const Image = mongoose.model("Image", ImageSchema);

export default Image;