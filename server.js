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

// --- Environment Variable Check (Recommended) ---
const requiredEnvVars = [
  "GEMINI_API_KEY",
  "NEBIUS_API_KEY",
  "RAZORPAY_KEY_ID",
  "RAZORPAY_SECRET",
  "MONGODB_URI",
  "CLIENT_URL", // Added CLIENT_URL check
  "PORT"         // Added PORT check (optional, but good practice)
];

const missingEnvVars = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingEnvVars.length > 0) {
  console.error(`Error: Missing required environment variables: ${missingEnvVars.join(", ")}`);
  process.exit(1); // Exit if critical variables are missing
}

// Log environment variable presence (Consider refining/removing for production)
console.log("GEMINI_API_KEY:", process.env.GEMINI_API_KEY ? "Set" : "Not set");
console.log("NEBIUS_API_KEY:", process.env.NEBIUS_API_KEY ? "Set" : "Not set");
console.log("RAZORPAY_KEY_ID:", process.env.RAZORPAY_KEY_ID ? "Set" : "Not set");
console.log("RAZORPAY_SECRET:", process.env.RAZORPAY_SECRET ? "Set" : "Not set");
console.log("MONGODB_URI:", process.env.MONGODB_URI ? "Set" : "Not set");
console.log("CLIENT_URL:", process.env.CLIENT_URL); // Log the actual URL for verification
console.log("PORT:", process.env.PORT);

const app = express();
const PORT = process.env.PORT || 5000; // Use defined PORT or fallback

// --- CORS Configuration ---
// Configure CORS more securely
const corsOptions = {
  origin: process.env.CLIENT_URL, // Allow requests only from your frontend URL
  methods: ["GET", "POST", "PUT", "DELETE"], // Allowed methods
  credentials: true, // Allow cookies/authorization headers if needed
};
app.use(cors(corsOptions));

// --- Middleware ---
app.use(express.json()); // For parsing application/json
// Consider adding express.urlencoded({ extended: true }) if you use form submissions
// app.use(express.urlencoded({ extended: true }));


// --- Initialize APIs ---
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


// --- API Endpoints ---

// Existing endpoint for text generation
app.post("/api/text", async (req, res) => {
  try {
    const { messages } = req.body;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: "Invalid or missing messages array" });
    }

    const lastUserMessage = messages[messages.length - 1];

    // Ensure history roles are 'user' or 'model' for Gemini API
    const chatHistory = messages
      .filter((msg, index) => msg.role !== "system" && index < messages.length - 1) // Exclude system message and last user message
      .map((msg) => ({
        role: msg.role === "user" ? "user" : "model", // Map 'assistant' to 'model'
        parts: [{ text: msg.content }],
      }));

    const chat = geminiModel.startChat({
      history: chatHistory,
    });

    const parts = [{ text: lastUserMessage.content || "" }];

    // Handle image files if they exist
    if (lastUserMessage.files && lastUserMessage.files.length > 0) {
      for (const file of lastUserMessage.files) {
        if (file.type && file.type.startsWith("image/")) { // Added check for file.type existence
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
             // Decide if you want to fail the whole request or just skip the image
          }
        }
      }
    }

    console.log("Sending to Gemini:", JSON.stringify({ history: chatHistory, message: parts }, null, 2)); // Debug log

    const result = await chat.sendMessage(parts);
    res.json({ content: result.response.text() });
  } catch (error) {
    console.error("Error calling Gemini API:", error);
    // Provide more specific error info if available from the API response
    const errorMessage = error.response?.data?.error?.message || error.message || "Something went wrong with the Gemini API";
    res.status(500).json({ error: errorMessage });
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
    const errorMessage = error.response?.data?.error?.message || error.message || "Something went wrong with the Nebius Studio API";
    res.status(500).json({ error: errorMessage });
  }
});

// New endpoint: Get or create user data
app.get("/api/user/:clerkUserId", async (req, res) => {
  console.log(`Received request for clerkUserId: ${req.params.clerkUserId}`);
  try {
    const { clerkUserId } = req.params;
    if (!clerkUserId) {
        return res.status(400).json({ message: "Clerk User ID is required" });
    }

    let user = await User.findOne({ clerkUserId });

    if (!user) {
      console.log(`User not found, creating new user with clerkUserId: ${clerkUserId}`);
      user = new User({ clerkUserId }); // Defaults like subscriptionStatus: 'free', chatAttempts: 0 should be set in the schema
      await user.save();
      console.log(`User saved with ID: ${user._id}`);
    } else {
      console.log(`User found with ID: ${user._id}`);
    }

    res.json(user);
  } catch (error) {
    console.error("Error in /api/user/:clerkUserId:", error);
    res.status(500).json({ message: "Server error finding or creating user" });
  }
});

// New endpoint: Send message with attempt limit
app.post("/api/messages", async (req, res) => {
  const { clerkUserId, message, isFromUser = true } = req.body; // Default isFromUser to true

  if (!clerkUserId || !message) {
      return res.status(400).json({ message: "Missing clerkUserId or message content" });
  }

  try {
    const user = await User.findOne({ clerkUserId });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Check chat attempt limit for free users *only if the message is from the user*
    if (isFromUser && user.subscriptionStatus === "free" && user.chatAttempts >= 6) { // Limit check applies to user messages
      console.log(`User ${clerkUserId} reached free limit.`);
      return res.status(403).json({ message: "Upgrade to pro to send more messages" });
    }

    // Save the message
    const newMessage = new Message({
      userId: user._id, // Link to the MongoDB user ID
      message,        // The actual message content
      isFromUser: isFromUser, // Record if it's from user or AI
      timestamp: new Date(),
    });
    await newMessage.save();
    console.log(`Message saved for user ${clerkUserId}`);

    // Increment chat attempts for free users *only if the message is from the user*
    if (isFromUser && user.subscriptionStatus === "free") {
      user.chatAttempts += 1;
      user.updatedAt = new Date(); // Update timestamp
      await user.save();
      console.log(`Incremented chat attempts for ${clerkUserId} to ${user.chatAttempts}`);
    }

    res.status(201).json(newMessage);
  } catch (error) {
    console.error("Error in POST /api/messages:", error);
    res.status(500).json({ message: "Server error saving message" });
  }
});


// New endpoint: Get chat history
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

    const messages = await Message.find({ userId: user._id }).sort({ timestamp: 1 }); // Sort by oldest first
    res.json(messages);
  } catch (error) {
    console.error("Error in GET /api/messages/:clerkUserId:", error);
    res.status(500).json({ message: "Server error retrieving messages" });
  }
});

// New endpoint: Create Razorpay order
app.post("/api/create-order", async (req, res) => {
  // Ensure amount and clerkUserId are provided
  const { amount, currency = "INR", clerkUserId } = req.body;

  if (!amount || typeof amount !== 'number' || amount <= 0) {
      return res.status(400).json({ message: "Invalid or missing amount" });
  }
   if (!clerkUserId) {
      return res.status(400).json({ message: "clerkUserId is required to create an order" });
  }

  try {
     // Find the user to ensure they exist (optional but good practice)
     const user = await User.findOne({ clerkUserId });
     if (!user) {
         return res.status(404).json({ message: "User not found" });
     }

    const options = {
      amount: Math.round(amount * 100), // Amount in paise (use Math.round for safety)
      currency: currency,
      receipt: `receipt_${clerkUserId}_${Date.now()}`, // Use clerkUserId in receipt
       notes: { // Add notes for easier tracking in Razorpay dashboard
           clerkUserId: clerkUserId,
           userId: user._id.toString() // Add MongoDB _id as well
       }
    };
    console.log("Creating Razorpay order with options:", options);
    const order = await razorpay.orders.create(options);
    console.log("Razorpay order created:", order);
    res.json(order);
  } catch (error) {
    console.error("Error creating Razorpay order:", error);
    // Check for Razorpay specific errors if possible
    const errorMessage = error.error?.description || error.message || "Server error creating payment order";
    res.status(error.statusCode || 500).json({ message: errorMessage });
  }
});

// New endpoint: Handle payment verification (Webhook Recommended)
// Note: This endpoint assumes the client sends verification data.
// A more robust approach is using Razorpay Webhooks.
app.post("/api/verify-payment", async (req, res) => {
  const { razorpay_payment_id, razorpay_order_id, razorpay_signature, clerkUserId } = req.body; // Ensure clerkUserId is sent by client

  if (!razorpay_payment_id || !razorpay_order_id || !razorpay_signature || !clerkUserId) {
      return res.status(400).json({ message: "Missing payment verification details or clerkUserId", success: false });
  }

  try {
     // IMPORTANT: Use crypto comparison for security
     const generated_signature = crypto
          .createHmac("sha256", process.env.RAZORPAY_SECRET) // Use the correct secret
          .update(razorpay_order_id + "|" + razorpay_payment_id)
          .digest("hex");

     if (generated_signature === razorpay_signature) {
          // Signature is valid

          // Retrieve the order details from Razorpay to confirm amount and get notes (like clerkUserId)
          // This is more reliable than trusting client-sent data entirely for critical actions
          const orderDetails = await razorpay.orders.fetch(razorpay_order_id);
          console.log("Fetched order details:", orderDetails);

          if (!orderDetails) {
               return res.status(404).json({ message: "Order not found on Razorpay", success: false });
          }

          // Double-check clerkUserId from notes if possible
          const orderClerkUserId = orderDetails.notes?.clerkUserId;
          if (!orderClerkUserId || orderClerkUserId !== clerkUserId) {
               console.warn(`ClerkUserId mismatch! Body: ${clerkUserId}, Order Notes: ${orderClerkUserId}`);
               // Handle discrepancy - potentially log and deny, or use orderClerkUserId if trusted
               return res.status(400).json({ message: "User ID mismatch during verification", success: false });
          }

          // Find the user using the verified clerkUserId
          const user = await User.findOne({ clerkUserId: orderClerkUserId });
          if (!user) {
               console.error(`User not found for clerkUserId ${orderClerkUserId} after payment verification.`);
               // Handle this case - maybe the user was deleted? Log and potentially refund.
               return res.status(404).json({ message: "User associated with order not found", success: false });
          }

          // Update user subscription status
          user.subscriptionStatus = "pro";
          user.chatAttempts = 0; // Reset attempts on upgrade
          user.updatedAt = new Date();
          await user.save();
          console.log(`Subscription updated to 'pro' for user ${user.clerkUserId}`);

          // Record the payment
          const newPayment = new Payment({
               userId: user._id,
               clerkUserId: user.clerkUserId, // Store clerkUserId too for easier lookup
               amount: orderDetails.amount / 100, // Use amount from fetched order
               currency: orderDetails.currency,
               status: "completed",
               orderId: razorpay_order_id,
               transactionId: razorpay_payment_id,
               method: req.body.method || 'unknown', // Optionally capture payment method if sent
               receipt: orderDetails.receipt
          });
          await newPayment.save();
          console.log(`Payment record saved for order ${razorpay_order_id}`);

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


// --- MongoDB Connection and Server Start ---
console.log("Attempting to connect to MongoDB...");
mongoose.connect(process.env.MONGODB_URI) // Removed deprecated options
  .then(() => {
    console.log("Successfully connected to MongoDB Atlas!");
    // Start the server only after successful MongoDB connection
    app.listen(PORT, () => {
      console.log(`Server running on port: ${PORT}`);
      console.log(`Accepting requests from: ${process.env.CLIENT_URL}`);
    });
  })
  .catch((err) => {
    console.error("MongoDB connection error:", err.message);
    process.exit(1); // Exit the application if DB connection fails
  });

// Add a basic root route for health check (optional)
app.get("/", (req, res) => {
  res.send(`API is running. Connected to MongoDB. Accepting requests from ${process.env.CLIENT_URL}. Current time: ${new Date()}`);
});

// Basic 404 handler for unhandled routes (optional)
app.use((req, res) => {
  res.status(404).send("Not Found");
});