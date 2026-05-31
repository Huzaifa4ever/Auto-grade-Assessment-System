import express from "express";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import EvaluationResult from "../models/EvaluationResult.js";
import StudentCopy from "../models/StudentCopy.js";
import Teacher from "../models/Teacher.js";
import Paper from "../models/Paper.js";
import dotenv from "dotenv";
import authMiddleware from "../middleware/authMiddleware.js";
import mongoose from "mongoose";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const TEMP_FOLDER = path.resolve(__dirname, '../../pdf_processor/temp');

const router = express.Router();


function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

const MAX_RETRIES = 3;

const PROVIDER_ENDPOINTS = {
    'cerebras-free': 'https://api.cerebras.ai/v1',
};
const PROVIDER_DEFAULT_MODELS = {
    'cerebras-free': 'gpt-oss-120b',
    'custom': '',
};
const PROVIDER_DEFAULT_RPM = {
    'cerebras-free': 5,
    'custom': 10,
};

function resolveLlmConfig(teacher) {
    if (teacher.llmConfig && teacher.llmConfig.provider) {
        const cfg = teacher.llmConfig;
        const isFree = cfg.provider === 'cerebras-free';
        return {
            provider: cfg.provider,
            teacherId: teacher._id.toString(),
            model: cfg.model || PROVIDER_DEFAULT_MODELS[cfg.provider] || 'gpt-oss-120b',
            apiKey: isFree ? process.env.CEREBRAS_API_KEY : cfg.apiKey,
            endpoint: isFree ? PROVIDER_ENDPOINTS['cerebras-free'] : cfg.endpoint,
            rpm: cfg.rpm || PROVIDER_DEFAULT_RPM[cfg.provider] || 5,
            tpm: cfg.tpm || 30000,
            fallbackEnabled: cfg.fallbackEnabled !== false,
        };
    }

    return {
        provider: 'cerebras-free',
        teacherId: teacher._id.toString(),
        model: teacher.llmModel || 'gpt-oss-120b',
        apiKey: process.env.CEREBRAS_API_KEY,
        endpoint: PROVIDER_ENDPOINTS['cerebras-free'],
        rpm: 5,
        tpm: 30000,
        fallbackEnabled: true,
    };
}


async function callLLMRaw(endpoint, apiKey, model, prompt) {
    const url = `${endpoint}/chat/completions`;
    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
            model,
            messages: [{ role: 'user', content: prompt }],
        }),
    });

    const quotaHeaders = {
        rpmLimit: parseInt(response.headers.get('x-ratelimit-limit-requests') || '0', 10),
        rpmRemaining: parseInt(response.headers.get('x-ratelimit-remaining-requests') || '0', 10),
        tpmLimit: parseInt(response.headers.get('x-ratelimit-limit-tokens') || '0', 10),
    };

    if (!response.ok) {
        const errorBody = await response.text().catch(() => '');
        const err = new Error(`${response.status} ${errorBody}`);
        err.status = response.status;
        err.quotaHeaders = quotaHeaders;
        throw err;
    }

    const data = await response.json();
    return {
        content: data.choices?.[0]?.message?.content || '',
        quotaHeaders,
    };
}

async function callLLMWithRetry(config, prompt) {
    const { endpoint, apiKey, model, rpm } = config;
    const baseDelay = Math.max(Math.ceil(60000 / (rpm || 5) * 1.2), 2000);
    let lastError = null;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
            console.log(`    [LLM] ${config.provider}/${model} (attempt ${attempt}/${MAX_RETRIES})`);
            const result = await callLLMRaw(endpoint, apiKey, model, prompt);
            return result;
        } catch (err) {
            lastError = err;
            const is429 = err.status === 429 || (err.message && (
                err.message.includes('429') ||
                err.message.toLowerCase().includes('rate') ||
                err.message.toLowerCase().includes('traffic')
            ));

            if (is429 && attempt < MAX_RETRIES) {
                const backoffMs = baseDelay * attempt;
                console.log(`    ⏳ Rate limited. Waiting ${(backoffMs / 1000).toFixed(1)}s before retry...`);
                await sleep(backoffMs);
            } else if (!is429) {
                break;
            }
        }
    }

    throw lastError || new Error('LLM call failed after retries');
}

function getConcurrencySettings(rpm) {
    if (rpm >= 60) return { concurrent: 4, delayMs: 1200 };
    if (rpm >= 30) return { concurrent: 3, delayMs: 2500 };
    if (rpm >= 15) return { concurrent: 2, delayMs: 4500 };
    if (rpm >= 10) return { concurrent: 1, delayMs: 7000 };
    return { concurrent: 1, delayMs: 13000 };
}

async function processWithConcurrency(items, concurrent, delayMs, processFn) {
    const results = new Array(items.length);
    let index = 0;

    async function worker() {
        while (index < items.length) {
            const i = index++;
            results[i] = await processFn(items[i], i);
            if (index < items.length && delayMs > 0) {
                await sleep(delayMs);
            }
        }
    }

    const workers = [];
    for (let w = 0; w < Math.min(concurrent, items.length); w++) {
        workers.push(worker());
        if (w < concurrent - 1 && concurrent > 1) {
            await sleep(Math.floor(delayMs / concurrent));
        }
    }
    await Promise.all(workers);
    return results;
}

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


function buildEvalPrompt(questionText, maxMarks, rubrics, studentAnswer) {
    const rubricsText = rubrics.length > 0
        ? rubrics.map((r, i) => `${i + 1}. ${r}`).join('\n')
        : 'No specific rubrics provided. Grade based on correctness and completeness.';

    return `You are an expert exam evaluator. Grade this student's handwritten answer that was extracted using OCR (Optical Character Recognition).

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
}

function parseLLMResponse(responseText, maxMarks) {
    let text = responseText.trim();
    if (text.startsWith("```json")) {
        text = text.replace(/^```json\s*/, "").replace(/\s*```$/, "");
    } else if (text.startsWith("```")) {
        text = text.replace(/^```\s*/, "").replace(/\s*```$/, "");
    }

    const parsed = JSON.parse(text);
    return {
        marks: Math.min(Math.max(Number(parsed.marks) || 0, 0), maxMarks),
        feedback: parsed.feedback || '',
        confidence: Math.min(Math.max(Number(parsed.confidence) || 70, 0), 100),
        ocrQuality: Math.min(Math.max(Number(parsed.ocr_quality) || 70, 0), 100),
    };
}


async function evaluateSingleQuestion(config, fallbackConfig, questionText, maxMarks, rubrics, studentAnswer) {
    const prompt = buildEvalPrompt(questionText, maxMarks, rubrics, studentAnswer);

    try {
        const result = await callLLMWithRetry(config, prompt);
        return parseLLMResponse(result.content, maxMarks);
    } catch (primaryErr) {
        console.error(`    ❌ Primary LLM failed: ${primaryErr.message}`);

        if (fallbackConfig && fallbackConfig.provider !== config.provider) {
            try {
                console.log(`    🔄 Falling back to ${fallbackConfig.provider}/${fallbackConfig.model}...`);
                const result = await callLLMWithRetry(fallbackConfig, prompt);
                return parseLLMResponse(result.content, maxMarks);
            } catch (fallbackErr) {
                console.error(`    ❌ Fallback LLM also failed: ${fallbackErr.message}`);
            }
        }

        return {
            marks: 0,
            feedback: `Evaluation error: ${primaryErr.message}. Please grade manually.`,
            confidence: 0,
            ocrQuality: 0,
        };
    }
}

router.post('/evaluate/:sessionId/:cmsId', authMiddleware, async (req, res) => {
    const { sessionId, cmsId } = req.params;

    try {
        // Load OCR results
        const ocrPath = path.resolve(TEMP_FOLDER, sessionId, cmsId, 'ocr_results.json');
        if (!ocrPath.startsWith(TEMP_FOLDER) || !fs.existsSync(ocrPath)) {
            return res.status(404).json({ success: false, error: 'OCR results not found. Run OCR first.' });
        }
        const ocrResults = JSON.parse(fs.readFileSync(ocrPath, 'utf-8'));

        const teacher = await Teacher.findById(req.teacherId);
        const config = resolveLlmConfig(teacher);

        const fallbackConfig = config.fallbackEnabled && config.provider !== 'cerebras-free'
            ? {
                provider: 'cerebras-free',
                model: 'gpt-oss-120b',
                apiKey: process.env.CEREBRAS_API_KEY,
                endpoint: PROVIDER_ENDPOINTS['cerebras-free'],
                rpm: 5,
            }
            : null;

        const { concurrent, delayMs } = getConcurrencySettings(config.rpm);
        console.log(`\n📝 Evaluation: ${cmsId}`);
        console.log(`   Provider: ${config.provider} | Model: ${config.model} | RPM: ${config.rpm} | Teacher: ${config.teacherId}`);
        console.log(`   Mode: ${concurrent > 1 ? `Parallel (${concurrent}x)` : 'Sequential'} | Delay: ${(delayMs / 1000).toFixed(1)}s`);

        const studentCopy = await StudentCopy.findOne({ sessionId, teacherId: req.teacherId }).populate('paperId');
        if (!studentCopy || !studentCopy.paperId) {
            return res.status(404).json({ success: false, error: 'No paper linked to this session.' });
        }
        const paper = studentCopy.paperId;

        const studentInfo = studentCopy.students.find(s => s.cmsId === cmsId);
        const studentName = studentInfo?.name || '';

        // Check if already evaluating
        const existing = await EvaluationResult.findOne({ sessionId, cmsId });
        if (existing && existing.status === 'evaluating') {
            return res.json({ success: true, message: 'Evaluation already in progress', result: existing });
        }

        // Create/update evaluation record
        await EvaluationResult.findOneAndUpdate(
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

        res.json({ success: true, message: 'Evaluation started' });

        const ocrQuestions = ocrResults.questions || {};
        const questionEntries = Object.entries(ocrQuestions).map(([questionKey, ocrData]) => {
            const paperMatch = matchQuestionToPaper(questionKey, paper);
            return {
                questionKey,
                questionText: paperMatch?.questionText || 'Question not found in paper',
                maxMarks: paperMatch?.maxMarks || 0,
                rubrics: paperMatch?.rubrics || [],
                studentAnswer: ocrData.extractedText || '',
            };
        });

        const questionResults = await processWithConcurrency(
            questionEntries,
            concurrent,
            delayMs,
            async (q, idx) => {
                console.log(`  [${idx + 1}/${questionEntries.length}] ${q.questionKey}...`);

                let llmResult;
                if (q.studentAnswer.trim().length < 5) {
                    llmResult = { marks: 0, feedback: 'No substantial answer provided.', confidence: 0, ocrQuality: 0 };
                } else {
                    llmResult = await evaluateSingleQuestion(
                        config, fallbackConfig,
                        q.questionText, q.maxMarks, q.rubrics, q.studentAnswer
                    );
                }

                console.log(`  ✓ ${q.questionKey}: ${llmResult.marks}/${q.maxMarks} (OCR: ${llmResult.ocrQuality}% | LLM: ${llmResult.confidence}%)`);

                return {
                    questionKey: q.questionKey,
                    questionText: q.questionText,
                    maxMarks: q.maxMarks,
                    obtainedMarks: llmResult.marks,
                    feedback: llmResult.feedback,
                    studentAnswer: q.studentAnswer,
                    rubrics: q.rubrics,
                    edited: false,
                    ocrConfidence: llmResult.ocrQuality,
                    llmConfidence: llmResult.confidence,
                };
            }
        );


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

        console.log(`✅ Complete: ${cmsId} — ${obtainedMarks}/${paper.totalMarks || 0} (OCR: ${ocrAccuracy}% | LLM: ${llmAccuracy}%)\n`);

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
