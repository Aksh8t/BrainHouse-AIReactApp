import express from "express";
import { GoogleGenerativeAI } from "@google/generative-ai";
import OpenAI from "openai";
import dotenv from "dotenv";
import cors from "cors";

dotenv.config();

console.log("GEMINI_API_KEY:", process.env.GEMINI_API_KEY);
console.log("NEBIUS_API_KEY:", process.env.NEBIUS_API_KEY);

const app = express();
app.use(cors());
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
            // Ensure file.data is a base64 string
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

// Endpoint for image generation (using Nebius Studio API)
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

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));