import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import connectDB from "./config/db.js";
import paperRoutes from "./routes/paperRoutes.js";
import studentTableRoutes from "./routes/studentCsvRoutes.js";
import courseRoutes from "./routes/courseRoutes.js";
import Cerebras from "@cerebras/cerebras_cloud_sdk";

dotenv.config();
connectDB();

const cerebras = new Cerebras({
  apiKey: process.env.CEREBRAS_API_KEY
});

const app = express();
app.use(cors());
app.use(express.json());

app.post("/api/parse-pdf-text", async (req, res) => {
  const { extractedText } = req.body;

  if (!extractedText || extractedText.trim() === "") {
    return res.status(400).json({ error: "Extracted text is required" });
  }

  try {
    const prompt = `You are an expert at parsing question papers. Analyze the following extracted text from a PDF question paper and extract all questions, parts, and sub-parts with their marks.

Extracted text:
${extractedText}

Extract the structure and return ONLY a valid JSON object in this exact format. Do not include any markdown code blocks, explanations, or additional text - just the raw JSON:

{
  "Q1": {
    "question": "Question text here",
    "marks": 3
  },
  "Q2": {
    "a": {
      "question": "Part a question text",
      "marks": 1.5
    },
    "b": {
      "question": "Part b question text",
      "marks": 1.5
    }
  },
  "Q3": {
    "a": {
      "i": {
        "question": "Sub-part i question text",
        "marks": 1.5
      },
      "ii": {
        "question": "Sub-part ii question text",
        "marks": 1.5
      }
    }
  }
}

CRITICAL RULES:
1. Use "Q1", "Q2", "Q3", etc. for question labels (exactly as shown)
2. Use lowercase letters "a", "b", "c", etc. for part labels (without parentheses)
3. Use lowercase roman numerals "i", "ii", "iii", "iv", "v", etc. for sub-part labels (without parentheses)
4. Always include both "question" (string) and "marks" (number) fields for each element
5. Marks should be numbers, can be decimals like 1.5 or 2.5
6. Return ONLY the raw JSON object - no markdown, no code blocks, no explanations
7. If a question has no parts, use format: {"Q1": {"question": "...", "marks": X}}
8. If a question has parts but no sub-parts, nest parts: {"Q2": {"a": {"question": "...", "marks": X}, "b": {...}}}
9. If a question has sub-parts, nest them: {"Q3": {"a": {"i": {"question": "...", "marks": X}, "ii": {...}}}}
10. Extract the actual question text and marks from the PDF - do not make up content

Return ONLY the JSON object now:`;

    let responseText;

    try {
      const chat = await cerebras.chat.completions.create({
        model: "llama3.1-8b",
        messages: [
          { role: "user", content: prompt }
        ]
      });

      responseText = chat?.choices?.[0]?.message?.content || "";

    } catch (err) {
      console.error("Error calling Cerebras LLM:", err);
      return res.status(500).json({
        success: false,
        error: "Failed to parse PDF text with LLM",
        details: err.message
      });
    }

    responseText = responseText.trim();
    if (responseText.startsWith("```json")) {
      responseText = responseText.replace(/^```json\s*/, "").replace(/\s*```$/, "");
    } else if (responseText.startsWith("```")) {
      responseText = responseText.replace(/^```\s*/, "").replace(/\s*```$/, "");
    }

    const parsedStructure = JSON.parse(responseText);
    res.json({ success: true, structure: parsedStructure });

  } catch (err) {
    console.error("Error parsing PDF text:", err);
    res.status(500).json({
      success: false,
      error: "Failed to parse PDF text",
      details: err.message
    });
  }
});

app.use("/api/papers", paperRoutes);
app.use("/api/student-tables", studentTableRoutes);
app.use("/api/courses", courseRoutes);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
