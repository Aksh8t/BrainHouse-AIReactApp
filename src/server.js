import express from "express";
import { GoogleGenerativeAI } from "@google/generative-ai";
import OpenAI from "openai"; // Use ES Module import
import dotenv from "dotenv";
import cors from "cors";

// Load environment variables
dotenv.config();

// Log the API keys to verify they're loaded
console.log("GEMINI_API_KEY:", process.env.GEMINI_API_KEY);
console.log("NEBIUS_API_KEY:", process.env.NEBIUS_API_KEY);

// Initialize Express app
const app = express();
app.use(cors());
app.use(express.json());

// Initialize Gemini API with system instruction
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const geminiModel = genAI.getGenerativeModel({
  model: "gemini-1.5-flash",
  systemInstruction:
    "You are a research assistant AI designed to help researchers. You can assist with article generation, summarizing research papers, answering research-related questions, and generating ideas for experiments. For image generation requests, I will handle them separately. Provide detailed, accurate, and professional responses suitable for academic and research purposes.",
});

// Initialize Nebius Studio API (OpenAI-compatible)
const nebiusClient = new OpenAI({
  baseURL: "https://api.studio.nebius.com/v1/",
  apiKey: process.env.NEBIUS_API_KEY,
});

// Endpoint for text generation (using Gemini API)
app.post("/api/text", async (req, res) => {
  try {
    const { messages } = req.body;

    // Validate request body
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: "Invalid or missing messages array" });
    }

    // Map roles to Gemini-compatible roles ("assistant" -> "model")
    const chatHistory = messages
      .filter((msg) => msg.role !== "system")
      .map((msg) => ({
        role: msg.role === "assistant" ? "model" : msg.role,
        parts: [{ text: msg.content }],
      }));

    // Start a chat session with the filtered history
    const chat = geminiModel.startChat({
      history: chatHistory,
    });

    // Send the latest user message
    const result = await chat.sendMessage(messages[messages.length - 1].content);
    res.json({ content: result.response.text() });
  } catch (error) {
    console.error("Error calling Gemini API:", error);
    res.status(500).json({ error: error.message || "Something went wrong with the Gemini API" });
  }
});

// Endpoint for image generation (using Nebius Studio API)
app.post("/api/image", async (req, res) => {
  try {
    const { prompt } = req.body;

    // Validate request body
    if (!prompt || typeof prompt !== "string") {
      return res.status(400).json({ error: "Invalid or missing prompt" });
    }

    // Generate image using Nebius Studio API
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

    // Extract the base64-encoded image data
    const imageBase64 = response.data[0].b64_json;
    const imageUrl = `data:image/png;base64,${imageBase64}`; // Convert to data URL for the client

    res.json({ image: imageUrl });
  } catch (error) {
    console.error("Error calling Nebius Studio API:", error);
    res.status(500).json({ error: error.message || "Something went wrong with the Nebius Studio API" });
  }
});

// Start the server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));