import mongoose from "mongoose";

const messageSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  message: { type: String, required: true },
  isFromUser: { type: Boolean, required: true }, // True for user messages, false
  timestamp: { type: Date, default: Date.now }
});

export default mongoose.model('Message', messageSchema);