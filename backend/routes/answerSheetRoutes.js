import express from "express";
import multer from "multer";
import fetch from "node-fetch";
import FormData from "form-data";

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
        console.error('Error proxying image:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch image'
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
