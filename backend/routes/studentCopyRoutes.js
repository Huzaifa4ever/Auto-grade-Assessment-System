import express from "express";
import StudentCopy from "../models/StudentCopy.js";

const router = express.Router();

router.get('/', async (req, res) => {
    try {
        const sessions = await StudentCopy.find()
            .sort({ createdAt: -1 })
            .populate('paperId', 'name courseCode');

        res.json({
            success: true,
            sessions
        });
    } catch (error) {
        console.error('Error fetching student copies:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to fetch student copies'
        });
    }
});

router.get('/:sessionId', async (req, res) => {
    try {
        const session = await StudentCopy.findOne({ sessionId: req.params.sessionId })
            .populate('paperId', 'name courseCode');

        if (!session) {
            return res.status(404).json({
                success: false,
                error: 'Session not found'
            });
        }

        res.json({
            success: true,
            session
        });
    } catch (error) {
        console.error('Error fetching session:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to fetch session'
        });
    }
});

router.post('/', async (req, res) => {
    try {
        const { sessionId, paperId, students } = req.body;

        if (!sessionId) {
            return res.status(400).json({
                success: false,
                error: 'Session ID is required'
            });
        }

        const existing = await StudentCopy.findOne({ sessionId });
        if (existing) {
            existing.students = students;
            existing.paperId = paperId;
            await existing.save();

            return res.json({
                success: true,
                session: existing,
                updated: true
            });
        }

        const session = new StudentCopy({
            sessionId,
            paperId,
            students
        });

        await session.save();

        res.status(201).json({
            success: true,
            session
        });
    } catch (error) {
        console.error('Error saving student copy session:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to save student copy session'
        });
    }
});

router.delete('/:sessionId', async (req, res) => {
    try {
        const result = await StudentCopy.findOneAndDelete({ sessionId: req.params.sessionId });

        if (!result) {
            return res.status(404).json({
                success: false,
                error: 'Session not found'
            });
        }

        res.json({
            success: true,
            message: 'Session deleted successfully'
        });
    } catch (error) {
        console.error('Error deleting session:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to delete session'
        });
    }
});

router.delete('/:sessionId/students/:cmsId', async (req, res) => {
    try {
        const { sessionId, cmsId } = req.params;

        const session = await StudentCopy.findOne({ sessionId });

        if (!session) {
            return res.status(404).json({
                success: false,
                error: 'Session not found'
            });
        }

        const initialCount = session.students.length;
        session.students = session.students.filter(s => s.cmsId !== cmsId);

        if (session.students.length === initialCount) {
            return res.status(404).json({
                success: false,
                error: 'Student not found in session'
            });
        }

        if (session.students.length === 0) {
            await StudentCopy.findOneAndDelete({ sessionId });
            return res.json({
                success: true,
                message: 'Student deleted. Session removed as it has no more students.',
                sessionDeleted: true
            });
        }

        await session.save();

        res.json({
            success: true,
            message: 'Student deleted successfully',
            remainingStudents: session.students.length
        });
    } catch (error) {
        console.error('Error deleting student:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to delete student'
        });
    }
});

router.delete('/', async (req, res) => {
    try {
        await StudentCopy.deleteMany({});

        res.json({
            success: true,
            message: 'All student copies cleared'
        });
    } catch (error) {
        console.error('Error clearing student copies:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to clear student copies'
        });
    }
});

export default router;
