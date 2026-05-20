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

function normalizeLabel(label) {
  return (label || '').replace(/[()]/g, '').trim().toLowerCase();
}

function matchQuestionToPaper(questionKey, paper) {
  if (!paper || !paper.questions) return null;
  const parts = questionKey.split('_');
  const qNum = parts[0];
  const partLabel = parts.length >= 2 ? parts[1] : null;
  const subPartLabel = parts.length >= 3 ? parts[2] : null;

  const question = paper.questions.find(q => q.label === qNum || q.id === qNum);
  if (!question) return null;

  if (!partLabel) {
    return { questionText: question.text || '', maxMarks: question.marks || 0, rubrics: (question.rubrics || []).map(r => r.text).filter(Boolean) };
  }

  const part = (question.parts || []).find(p => normalizeLabel(p.label) === partLabel.toLowerCase() || p.id === partLabel);
  if (!part) {
    return { questionText: question.text || '', maxMarks: question.marks || 0, rubrics: (question.rubrics || []).map(r => r.text).filter(Boolean) };
  }

  if (!subPartLabel) {
    return { questionText: part.text || question.text || '', maxMarks: part.marks || 0, rubrics: (part.rubrics || []).map(r => r.text).filter(Boolean) };
  }

  const subPart = (part.subParts || []).find(sp => normalizeLabel(sp.label) === subPartLabel.toLowerCase() || sp.id === subPartLabel);
  if (!subPart) {
    return { questionText: part.text || '', maxMarks: part.marks || 0, rubrics: (part.rubrics || []).map(r => r.text).filter(Boolean) };
  }

  return { questionText: subPart.text || part.text || '', maxMarks: subPart.marks || 0, rubrics: (subPart.rubrics || []).map(r => r.text).filter(Boolean) };
}

async function evaluateWithLLMInternal(questionText, maxMarks, rubrics, studentAnswer) {
  const rubricsText = rubrics.length > 0
    ? rubrics.map((r, i) => `${i + 1}. ${r}`).join('\n')
    : 'No specific rubrics provided. Grade based on correctness and completeness.';

  const prompt = `You are an expert exam evaluator. Grade this student's handwritten answer that was extracted using OCR (Optical Character Recognition).

Question: ${questionText}
Maximum Marks: ${maxMarks}
Marking Rubrics:
${rubricsText}

Student's Answer (OCR-extracted text from handwriting):
${studentAnswer}

Evaluate the student's answer and return ONLY a valid JSON object in this exact format:
{"marks": <number>, "feedback": "<string>", "confidence": <number>, "ocr_quality": <number>}

Rules:
- "marks" must be a number between 0 and ${maxMarks}
- "marks" can be a decimal (e.g., 1.5, 2.5) if appropriate
- "feedback" should explain what the student got right and wrong
- "confidence" must be a number between 0 and 100 indicating how confident you are in your grading
- "ocr_quality" must be a number between 0 and 100 indicating how well the OCR seems to have extracted the handwritten text
- Be fair but strict according to the rubrics
- If the answer is blank or completely wrong, give 0
- Return ONLY the JSON object, no markdown or extra text`;

  try {
    const chat = await cerebras.chat.completions.create({
      model: "llama3.1-8b",
      messages: [{ role: "user", content: prompt }]
    });

    let responseText = chat?.choices?.[0]?.message?.content || "";
    responseText = responseText.trim();
    if (responseText.startsWith("```json")) {
      responseText = responseText.replace(/^```json\s*/, "").replace(/\s*```$/, "");
    } else if (responseText.startsWith("```")) {
      responseText = responseText.replace(/^```\s*/, "").replace(/\s*```$/, "");
    }

    const parsed = JSON.parse(responseText);
    return {
      marks: Math.min(Math.max(Number(parsed.marks) || 0, 0), maxMarks),
      feedback: parsed.feedback || '',
      confidence: Math.min(Math.max(Number(parsed.confidence) || 70, 0), 100),
      ocrQuality: Math.min(Math.max(Number(parsed.ocr_quality) || 70, 0), 100)
    };
  } catch (err) {
    console.error('LLM evaluation error:', err.message);
    return { marks: 0, feedback: `Evaluation error: ${err.message}. Please grade manually.`, confidence: 0, ocrQuality: 0 };
  }
}

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

    // Respond immediately so the OCR route doesn't hang
    res.json({ success: true, message: 'Internal evaluation triggered' });

    // --- Actually run the LLM evaluation in the background ---
    try {
      console.log(`Internal evaluation started for ${cmsId} in ${sessionId}`);
      const questionResults = [];
      const ocrQuestions = ocrResults.questions || {};

      for (const [questionKey, ocrData] of Object.entries(ocrQuestions)) {
        console.log(`  Evaluating ${cmsId} — ${questionKey}...`);

        const paperMatch = matchQuestionToPaper(questionKey, paper);
        const questionText = paperMatch?.questionText || 'Question not found in paper';
        const maxMarks = paperMatch?.maxMarks || 0;
        const rubrics = paperMatch?.rubrics || [];
        const studentAnswer = ocrData.extractedText || '';

        let llmResult;
        if (studentAnswer.trim().length < 5) {
          llmResult = { marks: 0, feedback: 'No substantial answer provided.', confidence: 0, ocrQuality: 0 };
        } else {
          llmResult = await evaluateWithLLMInternal(questionText, maxMarks, rubrics, studentAnswer);
        }

        questionResults.push({
          questionKey,
          questionText,
          maxMarks,
          obtainedMarks: llmResult.marks,
          feedback: llmResult.feedback,
          studentAnswer,
          rubrics: rubrics,
          edited: false,
          ocrConfidence: llmResult.ocrQuality,
          llmConfidence: llmResult.confidence
        });

        console.log(`  ${questionKey}: ${llmResult.marks}/${maxMarks} (OCR: ${llmResult.ocrQuality}%, LLM: ${llmResult.confidence}%)`);
      }

      // Calculate totals and save as completed
      const obtainedMarks = questionResults.reduce((sum, q) => sum + q.obtainedMarks, 0);
      const ocrAccuracy = questionResults.length > 0
        ? Math.round(questionResults.reduce((s, q) => s + q.ocrConfidence, 0) / questionResults.length)
        : 0;
      const llmAccuracy = questionResults.length > 0
        ? Math.round(questionResults.reduce((s, q) => s + q.llmConfidence, 0) / questionResults.length)
        : 0;

      await EvaluationResult.findOneAndUpdate(
        { sessionId, cmsId },
        {
          status: 'completed',
          questions: questionResults,
          obtainedMarks,
          ocrAccuracy,
          llmAccuracy,
          evaluatedAt: new Date()
        }
      );

      console.log(`Evaluation complete for ${cmsId}: ${obtainedMarks}/${paper.totalMarks || 0} (OCR: ${ocrAccuracy}%, LLM: ${llmAccuracy}%)`);

    } catch (evalErr) {
      console.error(`Evaluation failed for ${cmsId}:`, evalErr);
      await EvaluationResult.findOneAndUpdate(
        { sessionId, cmsId },
        { status: 'error', errorMessage: evalErr.message }
      ).catch(() => { });
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
