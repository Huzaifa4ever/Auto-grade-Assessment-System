import express from "express";
import multer from "multer";
import fetch from "node-fetch";
import FormData from "form-data";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import StudentCopy from "../models/StudentCopy.js";
import StudentTable from "../models/StudentCsv.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const TEMP_FOLDER = path.resolve(__dirname, '../../pdf_processor/temp');

const router = express.Router();

const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 100 * 1024 * 1024 // 100MB limit
    },
    fileFilter: (req, file, cb) => {
        if (file.mimetype === 'application/pdf') {
            cb(null, true);
        } else {
            cb(new Error('Only PDF files are allowed'), false);
        }
    }
});

const PDF_PROCESSOR_URL = process.env.PDF_PROCESSOR_URL || 'http://localhost:5001';

router.post('/process', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                error: 'No PDF file provided'
            });
        }

        const paperId = req.body.paper_id || null;

        const formData = new FormData();
        formData.append('file', req.file.buffer, {
            filename: req.file.originalname,
            contentType: 'application/pdf'
        });
        if (paperId) {
            formData.append('paper_id', paperId);
        }

        const response = await fetch(`${PDF_PROCESSOR_URL}/api/process-pdf`, {
            method: 'POST',
            body: formData,
            headers: formData.getHeaders()
        });

        const result = await response.json();

        if (result.success) {
            // Save to MongoDB for persistent storage
            try {
                // Look up student names from StudentTable by CMS ID
                const allStudentTables = await StudentTable.find({}).lean();
                const studentNameMap = new Map();

                for (const table of allStudentTables) {
                    for (const student of table.students || []) {
                        if (student.cmsId && student.name) {
                            studentNameMap.set(student.cmsId.toLowerCase(), student.name);
                        }
                    }
                }

                const students = (result.students || []).map(s => {
                    const lookupName = studentNameMap.get(s.cms_id?.toLowerCase()) || s.name || '';
                    return {
                        cmsId: s.cms_id,
                        name: lookupName,
                        section: s.section || '',
                        courseCode: s.course_code || '',
                        totalPages: s.total_pages || 0,
                        pdfPath: s.pdf_path || null
                    };
                });

                await StudentCopy.findOneAndUpdate(
                    { sessionId: result.session_id },
                    {
                        sessionId: result.session_id,
                        paperId: paperId || null,
                        students
                    },
                    { upsert: true, new: true }
                );
                console.log(`Saved session ${result.session_id} to MongoDB with ${students.filter(s => s.name).length} named students`);

                try {
                    const ocrQueueResponse = await fetch(`http://localhost:${process.env.PORT || 5000}/api/ocr/queue`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            sessionId: result.session_id,
                            students: students.map(s => ({ cmsId: s.cmsId }))
                        })
                    });
                    if (ocrQueueResponse.ok) {
                        console.log(`OCR job auto-queued for session ${result.session_id}`);
                    }
                } catch (queueError) {
                    console.error('Error auto-queuing OCR:', queueError);
                }
            } catch (dbError) {
                console.error('Error saving to MongoDB:', dbError);
            }

            res.json(result);
        } else {
            res.status(500).json(result);
        }

    } catch (error) {
        console.error('Error processing answer sheets:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to process answer sheets'
        });
    }
});

router.get('/sessions', async (req, res) => {
    try {
        const response = await fetch(`${PDF_PROCESSOR_URL}/api/sessions`);
        const result = await response.json();
        res.json(result);
    } catch (error) {
        console.error('Error fetching sessions:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch sessions. Is the Python service running?'
        });
    }
});

router.delete('/sessions/:sessionId', async (req, res) => {
    try {
        const { sessionId } = req.params;
        const response = await fetch(`${PDF_PROCESSOR_URL}/api/sessions/${sessionId}`, {
            method: 'DELETE'
        });
        const result = await response.json();
        res.json(result);
    } catch (error) {
        console.error('Error deleting session:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to delete session'
        });
    }
});

router.delete('/clear-all', async (req, res) => {
    try {
        const response = await fetch(`${PDF_PROCESSOR_URL}/api/clear-all`, {
            method: 'DELETE'
        });
        const result = await response.json();
        res.json(result);
    } catch (error) {
        console.error('Error clearing all data:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to clear data'
        });
    }
});

router.get('/images/:sessionId/:studentId/:folder/:filename', async (req, res) => {
    try {
        const { sessionId, studentId, folder, filename } = req.params;

        const localPath = path.resolve(TEMP_FOLDER, sessionId, studentId, folder, filename);
        if (localPath.startsWith(TEMP_FOLDER) && fs.existsSync(localPath)) {
            return res.sendFile(localPath);
        }

        const imagePath = `${sessionId}/${studentId}/${folder}/${filename}`;
        const response = await fetch(`${PDF_PROCESSOR_URL}/api/images/${imagePath}`);

        if (!response.ok) {
            return res.status(response.status).json({ error: 'Image not found' });
        }

        const contentType = response.headers.get('content-type') || 'image/jpeg';
        res.setHeader('Content-Type', contentType);

        const arrayBuffer = await response.arrayBuffer();
        res.send(Buffer.from(arrayBuffer));

    } catch (error) {
        console.error('Error serving image:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch image'
        });
    }
});

router.get('/pdf/:sessionId/:cmsId', async (req, res) => {
    try {
        const { sessionId, cmsId } = req.params;
        const cmsIdSafe = cmsId.replace(/\//g, '-');
        const pdfPath = path.resolve(TEMP_FOLDER, sessionId, cmsIdSafe, 'answer_sheet.pdf');
        if (pdfPath.startsWith(TEMP_FOLDER) && fs.existsSync(pdfPath)) {
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `inline; filename="${cmsId}_answer_sheet.pdf"`);
            return res.sendFile(pdfPath);
        }

        const response = await fetch(`${PDF_PROCESSOR_URL}/api/student-pdf/${sessionId}/${cmsId}`);

        if (!response.ok) {
            return res.status(response.status).json({ error: 'PDF not found' });
        }

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename="${cmsId}_answer_sheet.pdf"`);

        const arrayBuffer = await response.arrayBuffer();
        res.send(Buffer.from(arrayBuffer));

    } catch (error) {
        console.error('Error serving PDF:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch PDF'
        });
    }
});

router.get('/health', async (req, res) => {
    try {
        const response = await fetch(`${PDF_PROCESSOR_URL}/api/health`);
        const result = await response.json();
        res.json({
            nodeService: 'ok',
            pythonService: result.status
        });
    } catch (error) {
        res.json({
            nodeService: 'ok',
            pythonService: 'unavailable',
            error: 'Python PDF processor service is not running'
        });
    }
});

export default router;
