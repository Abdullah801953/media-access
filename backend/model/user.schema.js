import mongoose from "mongoose";


const TokenSchema = new mongoose.Schema({
  token: { type: String, required: true },
  fileId: { type: String }, 
  fileName: { type: String }, 
  fileType: { type: String },
  expiresAt: { type: Date, required: true },
  createdAt: { type: Date, default: Date.now }
});

const UserSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  message: { type: String, default: "" },
  tokens: [TokenSchema],
  createdAt: { type: Date, default: Date.now }
});

const User = mongoose.model("User", UserSchema);

export default User;