import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import connectDB from "./config/db.js";
import paperRoutes from "./routes/paperRoutes.js";
import { GoogleGenerativeAI } from "@google/generative-ai"; 

dotenv.config();
connectDB();

const app = express();
app.use(cors());
app.use(express.json());

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);

app.post("/api/generate-rubric", async (req, res) => {
  const { question } = req.body;

  if (!question || question.trim() === "") {
    return res.status(400).json({ error: "Question text is required" });
  }

  try {
    const model = genAI.getGenerativeModel({ model: "gemini-pro" });

    const prompt = `
    Generate a clear, structured rubric for this question:
    "${question}"

    Requirements:
    - Include 5–6 detailed evaluation criteria.
    - Each criterion should include description and marks.
    - Return output in a neat, readable format.
    `;

    const result = await model.generateContent(prompt);
    const rubricText = result.response.text();

    res.json({ rubric: rubricText });
  } catch (err) {
    console.error("Error generating rubric:", err);
    res.status(500).json({ error: "Failed to generate rubric" });
  }
});

app.use("/api/papers", paperRoutes);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
