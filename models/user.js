// models/user.js
import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
  clerkUserId: {
    type: String,
    required: true,
    unique: true,
    index: true, // Added index for performance
  },
  subscriptionStatus: {
    type: String,
    default: "free",
    enum: ["free", "pro"], // Ensures only these values are allowed
  },
  chatAttempts: {
    type: Number,
    default: 0,
  },
  // Add any other fields you need for the user here
}, {
  timestamps: true // Automatically adds and manages createdAt and updatedAt
});

const User = mongoose.model("User", userSchema);

export default User;