import mongoose from "mongoose";
const paymentSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  amount: { type: Number, required: true },
  status: { type: String, required: true, enum: ["pending", "completed", "failed"] },
  transactionId: { type: String, required: true }, // razorpay_payment_id
  createdAt: { type: Date, default: Date.now },
});
export default mongoose.model("Payment", paymentSchema);