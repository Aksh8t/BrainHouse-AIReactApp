import express from "express";
import { GoogleGenerativeAI } from "@google/generative-ai";
import OpenAI from "openai";
import dotenv from "dotenv";
import cors from "cors";
import mongoose from "mongoose";
import Razorpay from "razorpay";

import User from "./models/user.js";
import Message from "./models/messages.js";
import Payment from "./models/payments.js";

dotenv.config();

// Log environment variables for debugging (remove sensitive logs in production)
console.log("GEMINI_API_KEY:", process.env.GEMINI_API_KEY ? "Set" : "Not set");
console.log("NEBIUS_API_KEY:", process.env.NEBIUS_API_KEY ? "Set" : "Not set");
console.log("RAZORPAY_KEY_ID:", process.env.RAZORPAY_KEY_ID ? "Set" : "Not set");
console.log("RAZORPAY_SECRET:", process.env.RAZORPAY_SECRET ? "Set" : "Not set");
console.log("MONGODB_URI:", process.env.MONGODB_URI ? "Set" : "Not set");
console.log("CLIENT_URL:", process.env.CLIENT_URL ? "Set" : "Not set");

const app = express();
app.use(cors());
app.use(express.json());

// MongoDB connection
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
  .then(() => console.log("Connected to MongoDB"))
  .catch((err) => console.error("MongoDB connection error:", err));

// Initialize APIs
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const geminiModel = genAI.getGenerativeModel({
  model: "gemini-1.5-flash",
  systemInstruction:
    "You are a research assistant AI designed to help researchers. You can assist with article generation, summarizing research papers, answering research-related questions, and generating ideas for experiments. For image generation requests, I will handle them separately. Provide detailed, accurate, and professional responses suitable for academic and research purposes.",
});

const nebiusClient = new OpenAI({
  baseURL: "https://api.studio.nebius.com/v1/",
  apiKey: process.env.NEBIUS_API_KEY,
});

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_SECRET,
});

// Existing endpoint for text generation
app.post("/api/text", async (req, res) => {
  try {
    const { messages } = req.body;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: "Invalid or missing messages array" });
    }

    const lastUserMessage = messages[messages.length - 1];

    const chatHistory = messages
      .filter((msg, index) => msg.role !== "system" && index < messages.length - 1)
      .map((msg) => ({
        role: msg.role === "assistant" ? "model" : msg.role,
        parts: [{ text: msg.content }],
      }));

    const chat = geminiModel.startChat({
      history: chatHistory,
    });

    const parts = [{ text: lastUserMessage.content || "" }];

    // Handle image files if they exist
    if (lastUserMessage.files && lastUserMessage.files.length > 0) {
      for (const file of lastUserMessage.files) {
        if (file.type.startsWith("image/")) {
          try {
            if (file.data && typeof file.data === "string" && file.data.startsWith("data:image")) {
              const base64Data = file.data.split(",")[1];
              parts.push({
                inlineData: {
                  data: base64Data,
                  mimeType: file.type,
                },
              });
            } else {
              console.warn("Invalid base64 data for file:", file.name);
            }
          } catch (imageError) {
            console.error("Error processing image:", imageError);
          }
        }
      }
    }

    const result = await chat.sendMessage(parts);
    res.json({ content: result.response.text() });
  } catch (error) {
    console.error("Error calling Gemini API:", error);
    res.status(500).json({ error: error.message || "Something went wrong with the Gemini API" });
  }
});

// Existing endpoint for image generation
app.post("/api/image", async (req, res) => {
  try {
    const { prompt } = req.body;

    if (!prompt || typeof prompt !== "string") {
      return res.status(400).json({ error: "Invalid or missing prompt" });
    }

    const response = await nebiusClient.images.generate({
      model: "stability-ai/sdxl",
      response_format: "b64_json",
      extra_body: {
        response_extension: "png",
        width: 1024,
        height: 1024,
        num_inference_steps: 30,
        negative_prompt: "",
        seed: -1,
      },
      prompt: prompt,
    });

    const imageBase64 = response.data[0].b64_json;
    const imageUrl = `data:image/png;base64,${imageBase64}`;

    res.json({ image: imageUrl });
  } catch (error) {
    console.error("Error calling Nebius Studio API:", error);
    res.status(500).json({ error: error.message || "Something went wrong with the Nebius Studio API" });
  }
});

// New endpoint: Get or create user data
app.get("/api/user/:clerkUserId", async (req, res) => {
  try {
    const { clerkUserId } = req.params;
    let user = await User.findOne({ clerkUserId });

    if (!user) {
      user = new User({ clerkUserId });
      await user.save();
    }

    res.json(user);
  } catch (error) {
    console.error("Error in /api/user:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// New endpoint: Send message with attempt limit
app.post("/api/messages", async (req, res) => {
  const { clerkUserId, message } = req.body;

  try {
    const user = await User.findOne({ clerkUserId });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Check chat attempt limit for free users
    if (user.subscriptionStatus === "free" && user.chatAttempts >= 6) {
      return res.status(403).json({ message: "Upgrade to pro to send more messages" });
    }

    // Save the message
    const newMessage = new Message({
      userId: user._id,
      message,
      isFromUser: true,
      timestamp: new Date(),
    });
    await newMessage.save();

    // Increment chat attempts for free users
    if (user.subscriptionStatus === "free") {
      user.chatAttempts += 1;
      user.updatedAt = new Date();
      await user.save();
    }

    res.status(201).json(newMessage);
  } catch (error) {
    console.error("Error in /api/messages:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// New endpoint: Get chat history
app.get("/api/messages/:clerkUserId", async (req, res) => {
  try {
    const { clerkUserId } = req.params;
    const user = await User.findOne({ clerkUserId });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const messages = await Message.find({ userId: user._id }).sort({ timestamp: 1 });
    res.json(messages);
  } catch (error) {
    console.error("Error in /api/messages GET:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// New endpoint: Create Razorpay order
app.post("/api/create-order", async (req, res) => {
  const { amount, currency, clerkUserId } = req.body;

  try {
    const options = {
      amount: amount * 100, // Amount in paise (smallest currency unit)
      currency: currency || "INR",
      receipt: `receipt_${clerkUserId}_${Date.now()}`,
    };

    const order = await razorpay.orders.create(options);
    res.json(order);
  } catch (error) {
    console.error("Error creating Razorpay order:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// New endpoint: Handle payment verification
app.post("/api/verify-payment", async (req, res) => {
  const { razorpay_payment_id, razorpay_order_id, razorpay_signature } = req.body;

  try {
    const isValid = razorpay.webhooks.verifyPaymentSignature({
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      secret: process.env.RAZORPAY_SECRET,
    });

    if (isValid) {
      const clerkUserId = req.body.clerkUserId || req.body.user_id; // Adjust based on your client data
      await User.updateOne(
        { clerkUserId },
        { subscriptionStatus: "pro", updatedAt: new Date() }
      );

      const newPayment = new Payment({
        userId: (await User.findOne({ clerkUserId }))._id,
        amount: req.body.amount / 100, // Convert back to currency unit
        status: "completed",
        transactionId: razorpay_payment_id,
      });
      await newPayment.save();

      res.json({ message: "Payment verified and subscription updated", success: true });
    } else {
      res.status(400).json({ message: "Invalid payment signature", success: false });
    }
  } catch (error) {
    console.error("Error in /api/verify-payment:", error);
    res.status(500).json({ message: "Server error", success: false });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));