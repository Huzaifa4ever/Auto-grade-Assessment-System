import express from "express";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import EvaluationResult from "../models/EvaluationResult.js";
import StudentCopy from "../models/StudentCopy.js";
import Paper from "../models/Paper.js";
import Cerebras from "@cerebras/cerebras_cloud_sdk";
import dotenv from "dotenv";
import authMiddleware from "../middleware/authMiddleware.js";
import mongoose from "mongoose";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const TEMP_FOLDER = path.resolve(__dirname, '../../pdf_processor/temp');

const cerebras = new Cerebras({
    apiKey: process.env.CEREBRAS_API_KEY
});

const router = express.Router();

// Question Matching

function normalizeLabel(label) {
    return (label || '').replace(/[()]/g, '').trim().toLowerCase();
}

function matchQuestionToPaper(questionKey, paper) {
    if (!paper || !paper.questions) return null;

    const parts = questionKey.split('_');
    const qNum = parts[0];
    const partLabel = parts.length >= 2 ? parts[1] : null;
    const subPartLabel = parts.length >= 3 ? parts[2] : null;

    const question = paper.questions.find(q =>
        q.label === qNum || q.id === qNum
    );
    if (!question) return null;

    if (!partLabel) {
        return {
            questionText: question.text || '',
            maxMarks: question.marks || 0,
            rubrics: (question.rubrics || []).map(r => r.text).filter(Boolean)
        };
    }

    const part = (question.parts || []).find(p =>
        normalizeLabel(p.label) === partLabel.toLowerCase() ||
        p.id === partLabel
    );
    if (!part) {
        return {
            questionText: question.text || '',
            maxMarks: question.marks || 0,
            rubrics: (question.rubrics || []).map(r => r.text).filter(Boolean)
        };
    }

    if (!subPartLabel) {
        return {
            questionText: part.text || question.text || '',
            maxMarks: part.marks || 0,
            rubrics: (part.rubrics || []).map(r => r.text).filter(Boolean)
        };
    }

    const subPart = (part.subParts || []).find(sp =>
        normalizeLabel(sp.label) === subPartLabel.toLowerCase() ||
        sp.id === subPartLabel
    );
    if (!subPart) {
        return {
            questionText: part.text || '',
            maxMarks: part.marks || 0,
            rubrics: (part.rubrics || []).map(r => r.text).filter(Boolean)
        };
    }

    return {
        questionText: subPart.text || part.text || '',
        maxMarks: subPart.marks || 0,
        rubrics: (subPart.rubrics || []).map(r => r.text).filter(Boolean)
    };
}

// LLM Evaluation ,per-question 

async function evaluateWithLLM(questionText, maxMarks, rubrics, studentAnswer) {
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
- "confidence" must be a number between 0 and 100 indicating how confident you are in your grading (100 = very confident the grade is accurate and you fully understand the answer, 50 = uncertain)
- "ocr_quality" must be a number between 0 and 100 indicating how well the OCR seems to have extracted the handwritten text. Consider:
  * Are there garbled or nonsensical words that look like OCR errors? (lower score)
  * Are sentences incomplete or cut off mid-word? (lower score)
  * Are there random characters, symbols, or formatting artifacts? (lower score)
  * Does the text flow naturally and make grammatical sense? (higher score)
  * Could spelling mistakes be from the student vs OCR errors? (student errors = higher OCR score)
  * Clean, coherent, well-structured text with no obvious OCR artifacts = 95-100
  * Minor formatting issues but fully readable = 85-94
  * Some garbled words or missing text = 60-84
  * Heavily garbled or mostly unreadable = below 60
- Be fair but strict according to the rubrics
- If the answer is mostly correct but has minor issues, give partial marks
- If the answer is blank or completely wrong, give 0
- Return ONLY the JSON object, no markdown or extra text`;

    try {
        const chat = await cerebras.chat.completions.create({
            model: "llama3.1-8b",
            messages: [
                { role: "user", content: prompt }
            ]
        });

        let responseText = chat?.choices?.[0]?.message?.content || "";
        responseText = responseText.trim();

        if (responseText.startsWith("```json")) {
            responseText = responseText.replace(/^```json\s*/, "").replace(/\s*```$/, "");
        } else if (responseText.startsWith("```")) {
            responseText = responseText.replace(/^```\s*/, "").replace(/\s*```$/, "");
        }

        const parsed = JSON.parse(responseText);
        const marks = Math.min(Math.max(Number(parsed.marks) || 0, 0), maxMarks);
        const feedback = parsed.feedback || '';
        const confidence = Math.min(Math.max(Number(parsed.confidence) || 70, 0), 100);
        const ocrQuality = Math.min(Math.max(Number(parsed.ocr_quality) || 70, 0), 100);

        return { marks, feedback, confidence, ocrQuality };
    } catch (err) {
        console.error('LLM evaluation error:', err.message);
        return {
            marks: 0,
            feedback: `Evaluation error: ${err.message}. Please grade manually.`,
            confidence: 0,
            ocrQuality: 0
        };
    }
}

// Routes

// Trigger evaluation for a student
router.post('/evaluate/:sessionId/:cmsId', authMiddleware, async (req, res) => {
    const { sessionId, cmsId } = req.params;

    try {
        // Load OCR results
        const ocrPath = path.resolve(TEMP_FOLDER, sessionId, cmsId, 'ocr_results.json');
        if (!ocrPath.startsWith(TEMP_FOLDER) || !fs.existsSync(ocrPath)) {
            return res.status(404).json({ success: false, error: 'OCR results not found. Run OCR first.' });
        }
        const ocrResults = JSON.parse(fs.readFileSync(ocrPath, 'utf-8'));

        // Find the StudentCopy to get paperId
        const studentCopy = await StudentCopy.findOne({ sessionId, teacherId: req.teacherId }).populate('paperId');
        if (!studentCopy || !studentCopy.paperId) {
            return res.status(404).json({ success: false, error: 'No paper linked to this session.' });
        }
        const paper = studentCopy.paperId;

        // Find student info
        const studentInfo = studentCopy.students.find(s => s.cmsId === cmsId);
        const studentName = studentInfo?.name || '';

        // Check if already evaluating
        const existing = await EvaluationResult.findOne({ sessionId, cmsId });
        if (existing && existing.status === 'evaluating') {
            return res.json({ success: true, message: 'Evaluation already in progress', result: existing });
        }

        // Create/update evaluation record
        const evalResult = await EvaluationResult.findOneAndUpdate(
            { sessionId, cmsId },
            {
                sessionId,
                paperId: paper._id,
                teacherId: req.teacherId,
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

        res.json({ success: true, message: 'Evaluation started', resultId: evalResult._id });

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
                llmResult = await evaluateWithLLM(questionText, maxMarks, rubrics, studentAnswer);
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

        // Calculate total and accuracy averages, then save
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

        console.log(` Evaluation complete for ${cmsId}: ${obtainedMarks}/${paper.totalMarks || 0} (OCR: ${ocrAccuracy}%, LLM: ${llmAccuracy}%)`);

    } catch (error) {
        console.error('Evaluation error:', error);
        await EvaluationResult.findOneAndUpdate(
            { sessionId, cmsId },
            { status: 'error', errorMessage: error.message }
        ).catch(() => { });
    }
});

// Get all results for a session
router.get('/results/:sessionId', authMiddleware, async (req, res) => {
    try {
        const results = await EvaluationResult.find({ sessionId: req.params.sessionId, teacherId: req.teacherId })
            .sort({ cmsId: 1 });
        res.json({ success: true, results });
    } catch (error) {
        console.error('Error fetching results:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get result for one student
router.get('/result/:sessionId/:cmsId', authMiddleware, async (req, res) => {
    try {
        const result = await EvaluationResult.findOne({
            sessionId: req.params.sessionId,
            cmsId: req.params.cmsId,
            teacherId: req.teacherId
        });
        if (!result) {
            return res.status(404).json({ success: false, error: 'Result not found' });
        }
        res.json({ success: true, result });
    } catch (error) {
        console.error('Error fetching result:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Teacher edits marks/feedback
router.put('/result/:sessionId/:cmsId', authMiddleware, express.json(), async (req, res) => {
    try {
        const { questions } = req.body;
        if (!questions || !Array.isArray(questions)) {
            return res.status(400).json({ success: false, error: 'questions array required' });
        }

        const result = await EvaluationResult.findOne({
            sessionId: req.params.sessionId,
            cmsId: req.params.cmsId,
            teacherId: req.teacherId
        });
        if (!result) {
            return res.status(404).json({ success: false, error: 'Result not found' });
        }

        for (const update of questions) {
            const qIdx = result.questions.findIndex(q => q.questionKey === update.questionKey);
            if (qIdx >= 0) {
                if (update.obtainedMarks !== undefined) {
                    result.questions[qIdx].obtainedMarks = Math.min(
                        Math.max(Number(update.obtainedMarks) || 0, 0),
                        result.questions[qIdx].maxMarks
                    );
                }
                if (update.feedback !== undefined) {
                    result.questions[qIdx].feedback = update.feedback;
                }
                result.questions[qIdx].edited = true;
            }
        }

        result.obtainedMarks = result.questions.reduce((sum, q) => sum + q.obtainedMarks, 0);
        result.editedAt = new Date();
        await result.save();

        res.json({ success: true, result });
    } catch (error) {
        console.error('Error updating result:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get evaluation status for a session
router.get('/status/:sessionId', authMiddleware, async (req, res) => {
    try {
        const results = await EvaluationResult.find(
            { sessionId: req.params.sessionId, teacherId: req.teacherId },
            { cmsId: 1, status: 1, obtainedMarks: 1, totalMarks: 1 }
        );
        res.json({ success: true, results });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get all sessions that have evaluation results
router.get('/sessions', authMiddleware, async (req, res) => {
    try {
        const teacherObjectId = new mongoose.Types.ObjectId(req.teacherId);
        const sessions = await EvaluationResult.aggregate([
            { $match: { teacherId: teacherObjectId } },
            {
                $group: {
                    _id: '$sessionId',
                    courseCode: { $first: '$courseCode' },
                    section: { $first: '$section' },
                    totalStudents: { $sum: 1 },
                    completedStudents: {
                        $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] }
                    },
                    avgScore: { $avg: '$obtainedMarks' },
                    totalMarks: { $first: '$totalMarks' },
                    avgOcrAccuracy: { $avg: { $cond: [{ $eq: ['$status', 'completed'] }, '$ocrAccuracy', null] } },
                    avgLlmAccuracy: { $avg: { $cond: [{ $eq: ['$status', 'completed'] }, '$llmAccuracy', null] } },
                    updatedAt: { $max: '$updatedAt' }
                }
            },
            { $sort: { updatedAt: -1 } }
        ]);

        res.json({
            success: true,
            sessions: sessions.map(s => ({
                sessionId: s._id,
                courseCode: s.courseCode,
                section: s.section,
                totalStudents: s.totalStudents,
                completedStudents: s.completedStudents,
                avgScore: Math.round((s.avgScore || 0) * 10) / 10,
                totalMarks: s.totalMarks,
                avgOcrAccuracy: Math.round((s.avgOcrAccuracy || 0) * 10) / 10,
                avgLlmAccuracy: Math.round((s.avgLlmAccuracy || 0) * 10) / 10,
                updatedAt: s.updatedAt
            }))
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Dashboard stats - global averages (per teacher)
router.get('/dashboard-stats', authMiddleware, async (req, res) => {
    try {
        const teacherObjectId = new mongoose.Types.ObjectId(req.teacherId);
        const stats = await EvaluationResult.aggregate([
            { $match: { status: 'completed', teacherId: teacherObjectId } },
            {
                $group: {
                    _id: null,
                    totalEvaluated: { $sum: 1 },
                    avgOcrAccuracy: { $avg: '$ocrAccuracy' },
                    avgLlmAccuracy: { $avg: '$llmAccuracy' }
                }
            }
        ]);

        const result = stats[0] || { totalEvaluated: 0, avgOcrAccuracy: 0, avgLlmAccuracy: 0 };
        res.json({
            success: true,
            stats: {
                totalEvaluated: result.totalEvaluated,
                avgOcrAccuracy: Math.round((result.avgOcrAccuracy || 0) * 10) / 10,
                avgLlmAccuracy: Math.round((result.avgLlmAccuracy || 0) * 10) / 10
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

export default router;
