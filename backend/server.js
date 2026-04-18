import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import connectDB from "./config/db.js";
import paperRoutes from "./routes/paperRoutes.js";
import studentTableRoutes from "./routes/studentCsvRoutes.js";
import courseRoutes from "./routes/courseRoutes.js";
import answerSheetRoutes from "./routes/answerSheetRoutes.js";
import studentCopyRoutes from "./routes/studentCopyRoutes.js";
import ocrRoutes from "./routes/ocrRoutes.js";
import evaluationRoutes from "./routes/evaluationRoutes.js";
import authRoutes from "./routes/authRoutes.js";
import authMiddleware from "./middleware/authMiddleware.js";
import Cerebras from "@cerebras/cerebras_cloud_sdk";
import EvaluationResult from "./models/EvaluationResult.js";
import StudentCopy from "./models/StudentCopy.js";
import Paper from "./models/Paper.js";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

dotenv.config();
connectDB();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const TEMP_FOLDER = path.resolve(__dirname, '../pdf_processor/temp');

const cerebras = new Cerebras({
  apiKey: process.env.CEREBRAS_API_KEY
});

const app = express();
app.use(cors());
app.use(express.json());

app.post("/api/parse-pdf-text", authMiddleware, async (req, res) => {
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

app.post("/api/evaluation/evaluate-internal/:sessionId/:cmsId", async (req, res) => {
  const { sessionId, cmsId } = req.params;

  try {
    // Find the StudentCopy to get paperId and teacherId
    const studentCopy = await StudentCopy.findOne({ sessionId }).populate('paperId');
    if (!studentCopy || !studentCopy.paperId) {
      return res.status(404).json({ success: false, error: 'No paper linked to this session.' });
    }

    const paper = studentCopy.paperId;
    const teacherId = studentCopy.teacherId;

    // Load OCR results
    const ocrPath = path.resolve(TEMP_FOLDER, sessionId, cmsId, 'ocr_results.json');
    if (!ocrPath.startsWith(TEMP_FOLDER) || !fs.existsSync(ocrPath)) {
      return res.status(404).json({ success: false, error: 'OCR results not found.' });
    }
    const ocrResults = JSON.parse(fs.readFileSync(ocrPath, 'utf-8'));

    // Find student info
    const studentInfo = studentCopy.students.find(s => s.cmsId === cmsId);
    const studentName = studentInfo?.name || '';

    // Check if already evaluating
    const existing = await EvaluationResult.findOne({ sessionId, cmsId });
    if (existing && existing.status === 'evaluating') {
      return res.json({ success: true, message: 'Evaluation already in progress' });
    }

    // Create/update evaluation record
    await EvaluationResult.findOneAndUpdate(
      { sessionId, cmsId },
      {
        sessionId,
        paperId: paper._id,
        teacherId: teacherId,
        cmsId,
        studentName,
        section: ocrResults.section || studentInfo?.section || '',
        courseCode: ocrResults.courseCode || studentInfo?.courseCode || '',
        status: 'evaluating',
        totalMarks: paper.totalMarks || 0,
        questions: [],
        errorMessage: null
      },
      { upsert: true, new: true }
    );

    res.json({ success: true, message: 'Internal evaluation triggered' });

    try {
      const port = process.env.PORT || 5000;
      console.log(`Internal evaluation triggered for ${cmsId} in ${sessionId}`);
    } catch (err) {
      console.error('Internal eval trigger error:', err);
    }
  } catch (error) {
    console.error('Internal evaluation error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.use("/api/papers", paperRoutes);
app.use("/api/student-tables", studentTableRoutes);
app.use("/api/courses", courseRoutes);
app.use("/api/answer-sheets", answerSheetRoutes);
app.use("/api/student-copies", studentCopyRoutes);
app.use("/api/ocr", ocrRoutes);
app.use("/api/evaluation", evaluationRoutes);
app.use("/api/auth", authRoutes);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
