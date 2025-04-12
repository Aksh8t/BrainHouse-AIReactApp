// api/image.js
import OpenAI from "openai";
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

const nebiusClient = new OpenAI({
  baseURL: "https://api.studio.nebius.com/v1/",
  apiKey: process.env.NEBIUS_API_KEY,
});

export default async function handler(req, res) {
  try {
    await runCorsMiddleware(req, res);

    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method Not Allowed" });
    }

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

    res.status(200).json({ image: imageUrl });

  } catch (error) {
    console.error("Error calling Nebius Studio API:", error);
    const errorMessage = error.response?.data?.error?.message || error.message || "Something went wrong with the Nebius Studio API";
    res.status(500).json({ error: errorMessage });
  }
}