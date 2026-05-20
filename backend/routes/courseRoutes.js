import express from 'express';
import Course from '../models/Course.js';
import authMiddleware from '../middleware/authMiddleware.js';

const router = express.Router();

router.use(authMiddleware);

router.get('/', async (req, res) => {
    try {
        const courses = await Course.find({ teacherId: req.teacherId }).sort({ courseCode: 1 });
        res.json(courses);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch courses', details: error.message });
    }
});

router.get('/search', async (req, res) => {
    try {
        const { q } = req.query;

        if (!q || q.trim() === '') {
            return res.json([]);
        }

        const searchTerm = q.trim();

        const courses = await Course.find({
            teacherId: req.teacherId,
            $or: [
                { courseCode: { $regex: searchTerm, $options: 'i' } },
                { courseName: { $regex: searchTerm, $options: 'i' } },
                { department: { $regex: searchTerm, $options: 'i' } },
                { prefix: { $regex: searchTerm, $options: 'i' } },
            ]
        }).limit(10).sort({ courseCode: 1 });

        res.json(courses);
    } catch (error) {
        res.status(500).json({ error: 'Search failed', details: error.message });
    }
});

router.post('/', async (req, res) => {
    try {
        const { courseCode, courseName, department } = req.body;

        if (!courseCode || !courseName || !department) {
            return res.status(400).json({ error: 'Course code, name, and department are required' });
        }

        if (!/^[A-Z]{3}\s+\d{3}$/.test(courseCode.toUpperCase())) {
            return res.status(400).json({
                error: 'Invalid course code format. Use format: ABC 123 (3 letters, space, 3 digits)'
            });
        }

        const existing = await Course.findOne({ courseCode: courseCode.toUpperCase(), teacherId: req.teacherId });
        if (existing) {
            return res.status(400).json({ error: 'Course code already exists' });
        }

        const course = new Course({
            courseCode: courseCode.toUpperCase(),
            courseName,
            department,
            teacherId: req.teacherId,
        });

        await course.save();
        res.status(201).json(course);
    } catch (error) {
        res.status(500).json({ error: 'Failed to create course', details: error.message });
    }
});

router.put('/:id', async (req, res) => {
    try {
        const { courseCode, courseName, department } = req.body;

        if (!courseCode || !courseName || !department) {
            return res.status(400).json({ error: 'Course code, name, and department are required' });
        }

        if (!/^[A-Z]{3}\s+\d{3}$/.test(courseCode.toUpperCase())) {
            return res.status(400).json({
                error: 'Invalid course code format. Use format: ABC 123 (3 letters, space, 3 digits)'
            });
        }

        const existing = await Course.findOne({
            courseCode: courseCode.toUpperCase(),
            teacherId: req.teacherId,
            _id: { $ne: req.params.id }
        });
        if (existing) {
            return res.status(400).json({ error: 'Course code already exists' });
        }

        const course = await Course.findOneAndUpdate(
            { _id: req.params.id, teacherId: req.teacherId },
            {
                courseCode: courseCode.toUpperCase(),
                courseName,
                department,
            },
            { new: true, runValidators: true }
        );

        if (!course) {
            return res.status(404).json({ error: 'Course not found' });
        }

        res.json(course);
    } catch (error) {
        res.status(500).json({ error: 'Failed to update course', details: error.message });
    }
});

router.delete('/:id', async (req, res) => {
    try {
        const course = await Course.findOneAndDelete({ _id: req.params.id, teacherId: req.teacherId });

        if (!course) {
            return res.status(404).json({ error: 'Course not found' });
        }

        res.json({ message: 'Course deleted successfully', course });
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete course', details: error.message });
    }
});

export default router;
