// api/text.js
import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from "dotenv";
import cors from "cors";

dotenv.config();

const corsMiddleware = cors({
  origin: process.env.CLIENT_URL,
  methods: ["POST"],
});

function runCorsMiddleware(req, res) {
  return new Promise((resolve, reject) => {
    corsMiddleware(req, res, (result) => {
      if (result instanceof Error) {
        return reject(result);
      }
      return resolve(result);
    });
  });
}

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const geminiModel = genAI.getGenerativeModel({
  model: "gemini-1.5-flash",
  systemInstruction:
    "You are a research assistant AI designed to help researchers. You can assist with article generation, summarizing research papers, answering research-related questions, and generating ideas for experiments. For image generation requests, I will handle them separately. Provide detailed, accurate, and professional responses suitable for academic and research purposes.",
});

export default async function handler(req, res) {
  try {
    await runCorsMiddleware(req, res);

    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method Not Allowed" });
    }

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
    const chat = geminiModel.startChat({ history: chatHistory });
    const parts = [{ text: lastUserMessage.content || "" }];

    if (lastUserMessage.files && lastUserMessage.files.length > 0) {
      for (const file of lastUserMessage.files) {
        if (file.type?.startsWith("image/")) {
          try {
            if (file.data?.startsWith("data:image")) {
              const base64Data = file.data.split(",")[1];
              parts.push({ inlineData: { data: base64Data, mimeType: file.type } });
            } else {
              console.warn("Invalid base64 data for file:", file.name);
            }
          } catch (imageError) {
            console.error("Error processing image:", imageError);
          }
        }
      }
    }

    console.log("Sending to Gemini:", JSON.stringify({ history: chatHistory, message: parts }, null, 2));
    const result = await chat.sendMessage(parts);
    res.status(200).json({ content: result.response.text() });

  } catch (error) {
    console.error("Error calling Gemini API:", error);
    const errorMessage = error.response?.data?.error?.message || error.message || "Something went wrong with the Gemini API";
    res.status(500).json({ error: errorMessage });
  }
}