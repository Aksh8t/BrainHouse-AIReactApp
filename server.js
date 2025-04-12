import express from "express";
import { GoogleGenerativeAI } from "@google/generative-ai";
import OpenAI from "openai";
import dotenv from "dotenv";
import cors from "cors";
import mongoose from "mongoose";
import Razorpay from "razorpay";
import crypto from 'crypto';

import User from "./models/user.js";
import Message from "./models/messages.js";
import Payment from "./models/payments.js";

dotenv.config();

const requiredEnvVars = [
  "GEMINI_API_KEY",
  "NEBIUS_API_KEY",
  "RAZORPAY_KEY_ID",
  "RAZORPAY_SECRET",
  "MONGODB_URI",
  "CLIENT_URL",
  "PORT"
];

const missingEnvVars = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingEnvVars.length > 0) {
  console.error(`Error: Missing required environment variables: ${missingEnvVars.join(", ")}`);
  process.exit(1);
}

const app = express();
const PORT = process.env.PORT || 5000;

const corsOptions = {
  origin: process.env.CLIENT_URL,
  methods: ["GET", "POST", "PUT", "DELETE"],
  credentials: true,
};
app.use(cors(corsOptions));

app.use(express.json());

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
        role: msg.role === "user" ? "user" : "model",
        parts: [{ text: msg.content }],
      }));

    const chat = geminiModel.startChat({
      history: chatHistory,
    });

    const parts = [{ text: lastUserMessage.content || "" }];

    if (lastUserMessage.files && lastUserMessage.files.length > 0) {
      for (const file of lastUserMessage.files) {
        if (file.type && file.type.startsWith("image/")) {
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
              console.warn("Invalid or missing base64 data for file:", file.name);
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
    const errorMessage = error.response?.data?.error?.message || error.message || "Something went wrong with the Gemini API";
    res.status(500).json({ error: errorMessage });
  }
});

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
    const errorMessage = error.response?.data?.error?.message || error.message || "Something went wrong with the Nebius Studio API";
    res.status(500).json({ error: errorMessage });
  }
});

app.get("/api/user/:clerkUserId", async (req, res) => {
  try {
    const { clerkUserId } = req.params;
    if (!clerkUserId) {
      return res.status(400).json({ message: "Clerk User ID is required" });
    }

    let user = await User.findOne({ clerkUserId });

    if (!user) {
      user = new User({ clerkUserId });
      await user.save();
    }

    res.json(user);
  } catch (error) {
    console.error("Error in /api/user/:clerkUserId:", error);
    res.status(500).json({ message: "Server error finding or creating user" });
  }
});

app.post("/api/messages", async (req, res) => {
  const { clerkUserId, message, isFromUser = true } = req.body;

  if (!clerkUserId || !message) {
    return res.status(400).json({ message: "Missing clerkUserId or message content" });
  }

  try {
    const user = await User.findOne({ clerkUserId });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (isFromUser && user.subscriptionStatus === "free" && user.chatAttempts >= 6) {
      return res.status(403).json({ message: "Upgrade to pro to send more messages" });
    }

    const newMessage = new Message({
      userId: user._id,
      message,
      isFromUser: isFromUser,
      timestamp: new Date(),
    });
    await newMessage.save();

    if (isFromUser && user.subscriptionStatus === "free") {
      user.chatAttempts += 1;
      user.updatedAt = new Date();
      await user.save();
    }

    res.status(201).json(newMessage);
  } catch (error) {
    console.error("Error in POST /api/messages:", error);
    res.status(500).json({ message: "Server error saving message" });
  }
});

app.get("/api/messages/:clerkUserId", async (req, res) => {
  try {
    const { clerkUserId } = req.params;
    if (!clerkUserId) {
      return res.status(400).json({ message: "Clerk User ID is required" });
    }

    const user = await User.findOne({ clerkUserId });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const messages = await Message.find({ userId: user._id }).sort({ timestamp: 1 });
    res.json(messages);
  } catch (error) {
    console.error("Error in GET /api/messages/:clerkUserId:", error);
    res.status(500).json({ message: "Server error retrieving messages" });
  }
});

app.post("/api/create-order", async (req, res) => {
  const { amount, currency = "INR", clerkUserId } = req.body;

  if (!amount || typeof amount !== 'number' || amount <= 0) {
    return res.status(400).json({ message: "Invalid or missing amount" });
  }
  if (!clerkUserId) {
    return res.status(400).json({ message: "clerkUserId is required to create an order" });
  }

  try {
    const user = await User.findOne({ clerkUserId });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const options = {
      amount: Math.round(amount * 100),
      currency: currency,
      receipt: `receipt_${clerkUserId}_${Date.now()}`,
      notes: {
        clerkUserId: clerkUserId,
        userId: user._id.toString()
      }
    };
    const order = await razorpay.orders.create(options);
    res.json(order);
  } catch (error) {
    console.error("Error creating Razorpay order:", error);
    const errorMessage = error.error?.description || error.message || "Server error creating payment order";
    res.status(error.statusCode || 500).json({ message: errorMessage });
  }
});

app.post("/api/verify-payment", async (req, res) => {
  const { razorpay_payment_id, razorpay_order_id, razorpay_signature, clerkUserId } = req.body;

  if (!razorpay_payment_id || !razorpay_order_id || !razorpay_signature || !clerkUserId) {
    return res.status(400).json({ message: "Missing payment verification details or clerkUserId", success: false });
  }

  try {
    const generated_signature = crypto
      .createHmac("sha256", process.env.RAZORPAY_SECRET)
      .update(razorpay_order_id + "|" + razorpay_payment_id)
      .digest("hex");

    if (generated_signature === razorpay_signature) {
      const orderDetails = await razorpay.orders.fetch(razorpay_order_id);

      if (!orderDetails) {
        return res.status(404).json({ message: "Order not found on Razorpay", success: false });
      }

      const orderClerkUserId = orderDetails.notes?.clerkUserId;
      if (!orderClerkUserId || orderClerkUserId !== clerkUserId) {
        console.warn(`ClerkUserId mismatch! Body: ${clerkUserId}, Order Notes: ${orderClerkUserId}`);
        return res.status(400).json({ message: "User ID mismatch during verification", success: false });
      }

      const user = await User.findOne({ clerkUserId: orderClerkUserId });
      if (!user) {
        console.error(`User not found for clerkUserId ${orderClerkUserId} after payment verification.`);
        return res.status(404).json({ message: "User associated with order not found", success: false });
      }

      user.subscriptionStatus = "pro";
      user.chatAttempts = 0;
      user.updatedAt = new Date();
      await user.save();

      const newPayment = new Payment({
        userId: user._id,
        clerkUserId: user.clerkUserId,
        amount: orderDetails.amount / 100,
        currency: orderDetails.currency,
        status: "completed",
        orderId: razorpay_order_id,
        transactionId: razorpay_payment_id,
        method: req.body.method || 'unknown',
        receipt: orderDetails.receipt
      });
      await newPayment.save();

      res.json({ message: "Payment verified and subscription updated", success: true });

    } else {
      console.warn(`Invalid payment signature for order ${razorpay_order_id}`);
      res.status(400).json({ message: "Invalid payment signature", success: false });
    }
  } catch (error) {
    console.error("Error in /api/verify-payment:", error);
    const errorMessage = error.error?.description || error.message || "Server error verifying payment";
    res.status(error.statusCode || 500).json({ message: errorMessage, success: false });
  }
});

mongoose.connect(process.env.MONGODB_URI)
  .then(() => {
    console.log("Successfully connected to MongoDB Atlas!");
    app.listen(PORT, () => {
      console.log(`Server running on port: ${PORT}`);
      console.log(`Accepting requests from: ${process.env.CLIENT_URL}`);
    });
  })
  .catch((err) => {
    console.error("MongoDB connection error:", err.message);
    process.exit(1);
  });

app.get("/", (req, res) => {
  res.send(`API is running. Connected to MongoDB. Accepting requests from ${process.env.CLIENT_URL}. Current time: ${new Date()}`);
});

app.use((req, res) => {
  res.status(404).send("Not Found");
});