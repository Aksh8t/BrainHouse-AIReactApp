import express from "express";
import { GoogleGenerativeAI } from "@google/generative-ai";
import Replicate from "replicate";
import dotenv from "dotenv";
import cors from "cors";

// Load environment variables
dotenv.config();

// Initialize Express app
const app = express();
app.use(cors());
app.use(express.json());

// Initialize Gemini API with system instruction
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const geminiModel = genAI.getGenerativeModel({
  model: "gemini-2.0-flash",
  systemInstruction:
    "You are a research assistant AI designed to help researchers. You can assist with article generation, summarizing research papers, answering research-related questions, and generating ideas for experiments. For image generation requests, I will handle them separately. Provide detailed, accurate, and professional responses suitable for academic and research purposes.",
});

// Initialize Replicate API
const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN,
});

// Endpoint for text generation
app.post("/api/text", async (req, res) => {
  try {
    const { messages } = req.body;

    // Filter out any system messages (though there shouldn't be any now)
    const chatHistory = messages
      .filter((msg) => msg.role !== "system")
      .map((msg) => ({
        role: msg.role,
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
    res.status(500).json({ error: "Something went wrong" });
  }
});

// Endpoint for image generation
app.post("/api/image", async (req, res) => {
  try {
    const { prompt } = req.body;
    const output = await replicate.run(
      "stability-ai/stable-diffusion:ac732df83cea7fff18b8472768c88ad041fa750ff7682a21affe81863cbe77e",
      {
        input: {
          prompt,
          num_outputs: 1,
          width: 512,
          height: 512,
        },
      }
    );
    res.json({ image: output[0] });
  } catch (error) {
    console.error("Error calling Replicate API:", error);
    res.status(500).json({ error: "Something went wrong" });
  }
});

// Start the server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));