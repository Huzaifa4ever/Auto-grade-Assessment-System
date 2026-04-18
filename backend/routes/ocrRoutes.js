import express from "express";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import authMiddleware from "../middleware/authMiddleware.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const TEMP_FOLDER = path.resolve(__dirname, '../../pdf_processor/temp');

const router = express.Router();

// List all sessions with their students and cropped images
router.get('/sessions', async (req, res) => {
    try {
        if (!fs.existsSync(TEMP_FOLDER)) {
            return res.json({ success: true, sessions: [] });
        }

        const sessions = [];
        const sessionDirs = fs.readdirSync(TEMP_FOLDER)
            .filter(d => d.startsWith('session_') && fs.statSync(path.join(TEMP_FOLDER, d)).isDirectory())
            .sort().reverse();

        for (const sessionDir of sessionDirs) {
            const sessionPath = path.join(TEMP_FOLDER, sessionDir);
            const students = [];

            const studentDirs = fs.readdirSync(sessionPath)
                .filter(d => fs.statSync(path.join(sessionPath, d)).isDirectory());

            for (const studentDir of studentDirs) {
                const croppedPath = path.join(sessionPath, studentDir, 'cropped');
                if (!fs.existsSync(croppedPath)) continue;

                const images = fs.readdirSync(croppedPath)
                    .filter(f => f.endsWith('.jpg') || f.endsWith('.png'))
                    .sort();

                const hasOcrResults = fs.existsSync(
                    path.join(sessionPath, studentDir, 'ocr_results.json')
                );

                students.push({
                    cmsId: studentDir,
                    croppedImages: images,
                    ocrCompleted: hasOcrResults
                });
            }

            if (students.length > 0) {
                sessions.push({
                    sessionId: sessionDir,
                    students
                });
            }
        }

        res.json({ success: true, sessions });
    } catch (error) {
        console.error('Error listing OCR sessions:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Serve a specific cropped image
router.get('/image/:sessionId/:cmsId/:filename', (req, res) => {
    try {
        const { sessionId, cmsId, filename } = req.params;
        const imagePath = path.resolve(TEMP_FOLDER, sessionId, cmsId, 'cropped', filename);

        if (!imagePath.startsWith(TEMP_FOLDER)) {
            return res.status(403).json({ error: 'Invalid path' });
        }

        if (!fs.existsSync(imagePath)) {
            return res.status(404).json({ error: 'Image not found' });
        }

        res.sendFile(imagePath);
    } catch (error) {
        console.error('Error serving OCR image:', error);
        res.status(500).json({ error: error.message });
    }
});

// Save OCR results for a student
router.post('/results/:sessionId/:cmsId', express.json({ limit: '50mb' }), (req, res) => {
    try {
        const { sessionId, cmsId } = req.params;
        const resultsPath = path.resolve(TEMP_FOLDER, sessionId, cmsId, 'ocr_results.json');

        if (!resultsPath.startsWith(TEMP_FOLDER)) {
            return res.status(403).json({ error: 'Invalid path' });
        }

        const dirPath = path.dirname(resultsPath);
        if (!fs.existsSync(dirPath)) {
            return res.status(404).json({ error: 'Student directory not found' });
        }

        fs.writeFileSync(resultsPath, JSON.stringify(req.body, null, 2));
        console.log(`Saved OCR results for ${cmsId} in ${sessionId}`);
        res.json({ success: true, message: 'OCR results saved' });

        try {
            const port = process.env.PORT || 5000;
            fetch(`http://localhost:${port}/api/evaluation/evaluate-internal/${sessionId}/${cmsId}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            }).then(() => {
                console.log(`LLM evaluation auto-triggered for ${cmsId}`);
            }).catch(err => {
                console.error(`Auto-evaluation trigger failed for ${cmsId}:`, err.message);
            });
        } catch (triggerErr) {
            console.error('Error triggering evaluation:', triggerErr);
        }
    } catch (error) {
        console.error('Error saving OCR results:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get OCR results for a student
router.get('/results/:sessionId/:cmsId', (req, res) => {
    try {
        const { sessionId, cmsId } = req.params;
        const resultsPath = path.resolve(TEMP_FOLDER, sessionId, cmsId, 'ocr_results.json');

        if (!resultsPath.startsWith(TEMP_FOLDER)) {
            return res.status(403).json({ error: 'Invalid path' });
        }

        if (!fs.existsSync(resultsPath)) {
            return res.status(404).json({ success: false, error: 'OCR results not found' });
        }

        const results = JSON.parse(fs.readFileSync(resultsPath, 'utf-8'));
        res.json({ success: true, results });
    } catch (error) {
        console.error('Error reading OCR results:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Delete OCR results for a student
router.delete('/results/:sessionId/:cmsId', (req, res) => {
    try {
        const { sessionId, cmsId } = req.params;
        const resultsPath = path.resolve(TEMP_FOLDER, sessionId, cmsId, 'ocr_results.json');

        if (!resultsPath.startsWith(TEMP_FOLDER)) {
            return res.status(403).json({ error: 'Invalid path' });
        }

        if (!fs.existsSync(resultsPath)) {
            return res.status(404).json({ success: false, error: 'OCR results not found' });
        }

        fs.unlinkSync(resultsPath);
        res.json({ success: true, message: 'OCR results deleted' });
    } catch (error) {
        console.error('Error deleting OCR results:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// OCR Job Queue, auto-triggers OCR for newly processed sessions
const ocrJobQueue = [];

router.post('/queue', authMiddleware, express.json(), (req, res) => {
    try {
        const { sessionId, students } = req.body;
        if (!sessionId) {
            return res.status(400).json({ success: false, error: 'sessionId required' });
        }

        const existingIdx = ocrJobQueue.findIndex(j => j.sessionId === sessionId);
        if (existingIdx >= 0) {
            ocrJobQueue.splice(existingIdx, 1);
        }

        ocrJobQueue.push({
            sessionId,
            students: students || [],
            status: 'pending',
            createdAt: new Date().toISOString()
        });

        console.log(`OCR job queued for session: ${sessionId}`);
        res.json({ success: true, message: 'OCR job queued' });
    } catch (error) {
        console.error('Error queuing OCR job:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

router.get('/queue/next', (req, res) => {
    const pendingJob = ocrJobQueue.find(j => j.status === 'pending');
    if (!pendingJob) {
        return res.json({ success: true, job: null });
    }

    pendingJob.status = 'processing';
    res.json({ success: true, job: pendingJob });
});

router.post('/queue/complete', express.json(), (req, res) => {
    const { sessionId } = req.body;
    const jobIdx = ocrJobQueue.findIndex(j => j.sessionId === sessionId);
    if (jobIdx >= 0) {
        ocrJobQueue[jobIdx].status = 'completed';
        console.log(`OCR job completed for session: ${sessionId}`);
    }
    res.json({ success: true });
});

router.get('/queue/status', (req, res) => {
    res.json({
        success: true,
        queue: ocrJobQueue.map(j => ({
            sessionId: j.sessionId,
            status: j.status,
            createdAt: j.createdAt
        }))
    });
});

export default router;
