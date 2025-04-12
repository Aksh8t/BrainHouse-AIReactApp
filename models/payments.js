import mongoose from "mongoose";
const paymentSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  amount: { type: Number, required: true },
  currency: { type: String, default: "INR" },
  status: { type: String, required: true, enum: ["pending", "completed", "failed"] },
  orderId: { type: String }, // Razorpay order ID
  transactionId: { type: String }, // Razorpay payment ID
  receipt: { type: String }, // Razorpay receipt ID
  method: { type: String }, // Optional: Payment method
  clerkUserId: { type: String }, // Clerk User ID for easier querying
  createdAt: { type: Date, default: Date.now },
});
export default mongoose.model("Payment", paymentSchema);