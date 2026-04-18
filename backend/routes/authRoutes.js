import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import nodemailer from "nodemailer";
import Teacher from "../models/Teacher.js";
import dotenv from "dotenv";

dotenv.config();

const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || "auto-grade-secret-key-2026";

function createTransporter() {
    return nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS
        }
    });
}

router.post('/signup', express.json(), async (req, res) => {
    try {
        const { name, email, userId, password } = req.body;

        if (!name || !email || !userId || !password) {
            return res.status(400).json({ success: false, error: 'All fields are required' });
        }

        if (password.length < 5) {
            return res.status(400).json({ success: false, error: 'Password must be at least 5 characters' });
        }

        // Check if userId or email already exists
        const existingUser = await Teacher.findOne({ $or: [{ userId }, { email }] });
        if (existingUser) {
            if (existingUser.userId === userId) {
                return res.status(400).json({ success: false, error: 'User ID already taken' });
            }
            return res.status(400).json({ success: false, error: 'Email already registered' });
        }

        // Hash password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // Create teacher
        const teacher = new Teacher({
            name,
            email,
            userId,
            password: hashedPassword
        });

        await teacher.save();

        // Generate token
        const token = jwt.sign(
            { id: teacher._id, userId: teacher.userId },
            JWT_SECRET,
            {}
        );

        res.json({
            success: true,
            token,
            teacher: {
                name: teacher.name,
                email: teacher.email,
                userId: teacher.userId
            }
        });
    } catch (error) {
        console.error('Signup error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Login

router.post('/login', express.json(), async (req, res) => {
    try {
        const { userId, password } = req.body;

        if (!userId || !password) {
            return res.status(400).json({ success: false, error: 'User ID and password are required' });
        }

        // Find teacher
        const teacher = await Teacher.findOne({ userId });
        if (!teacher) {
            return res.status(401).json({ success: false, error: 'Invalid User ID or password' });
        }

        // Check password
        const isMatch = await bcrypt.compare(password, teacher.password);
        if (!isMatch) {
            return res.status(401).json({ success: false, error: 'Invalid User ID or password' });
        }

        // Generate token
        const token = jwt.sign(
            { id: teacher._id, userId: teacher.userId },
            JWT_SECRET,
            {}
        );

        res.json({
            success: true,
            token,
            teacher: {
                name: teacher.name,
                email: teacher.email,
                userId: teacher.userId
            }
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get current user

router.get('/me', async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ success: false, error: 'No token provided' });
        }

        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, JWT_SECRET);

        const teacher = await Teacher.findById(decoded.id).select('-password -resetCode -resetCodeExpires');
        if (!teacher) {
            return res.status(404).json({ success: false, error: 'Teacher not found' });
        }

        res.json({
            success: true,
            teacher: {
                name: teacher.name,
                email: teacher.email,
                userId: teacher.userId
            }
        });
    } catch (error) {
        if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
            return res.status(401).json({ success: false, error: 'Invalid or expired token' });
        }
        res.status(500).json({ success: false, error: error.message });
    }
});

// Forgot Password 

router.post('/forgot-password', express.json(), async (req, res) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({ success: false, error: 'Email is required' });
        }

        const teacher = await Teacher.findOne({ email });
        if (!teacher) {
            return res.status(404).json({ success: false, error: 'No account found with this email' });
        }

        // Generate 6-digit reset code
        const resetCode = Math.floor(100000 + Math.random() * 900000).toString();
        const resetCodeExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

        teacher.resetCode = resetCode;
        teacher.resetCodeExpires = resetCodeExpires;
        await teacher.save();

        // Send email
        try {
            const transporter = createTransporter();
            await transporter.sendMail({
                from: process.env.EMAIL_USER,
                to: email,
                subject: 'Auto-Grade System — Password Reset Code',
                html: `
                    <div style="font-family: 'Segoe UI', sans-serif; max-width: 500px; margin: 0 auto; padding: 24px;">
                        <h2 style="color: #1e40af; margin-bottom: 16px;">Password Reset</h2>
                        <p>Hello <strong>${teacher.name}</strong>,</p>
                        <p>Your password reset code is:</p>
                        <div style="background: #f0f9ff; border: 2px solid #3b82f6; border-radius: 12px; padding: 20px; text-align: center; margin: 16px 0;">
                            <span style="font-size: 32px; font-weight: 700; letter-spacing: 8px; color: #1e40af;">${resetCode}</span>
                        </div>
                        <p style="color: #64748b; font-size: 14px;">This code expires in 10 minutes.</p>
                        <p style="color: #94a3b8; font-size: 12px; margin-top: 24px;">If you didn't request this, please ignore this email.</p>
                    </div>
                `
            });

            res.json({ success: true, message: 'Reset code sent to your email' });
        } catch (emailErr) {
            console.error('Email send error:', emailErr);
            res.json({
                success: true,
                message: 'Reset code generated (email service not configured)',
                devCode: process.env.NODE_ENV !== 'production' ? resetCode : undefined
            });
        }
    } catch (error) {
        console.error('Forgot password error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Reset Password 

router.post('/reset-password', express.json(), async (req, res) => {
    try {
        const { email, code, newPassword } = req.body;

        if (!email || !code || !newPassword) {
            return res.status(400).json({ success: false, error: 'Email, code, and new password are required' });
        }

        if (newPassword.length < 5) {
            return res.status(400).json({ success: false, error: 'Password must be at least 5 characters' });
        }

        const teacher = await Teacher.findOne({ email });
        if (!teacher) {
            return res.status(404).json({ success: false, error: 'No account found with this email' });
        }

        // Verify code
        if (!teacher.resetCode || teacher.resetCode !== code) {
            return res.status(400).json({ success: false, error: 'Invalid reset code' });
        }

        if (teacher.resetCodeExpires && teacher.resetCodeExpires < new Date()) {
            return res.status(400).json({ success: false, error: 'Reset code has expired' });
        }

        // Update password
        const salt = await bcrypt.genSalt(10);
        teacher.password = await bcrypt.hash(newPassword, salt);
        teacher.resetCode = null;
        teacher.resetCodeExpires = null;
        await teacher.save();

        res.json({ success: true, message: 'Password reset successfully' });
    } catch (error) {
        console.error('Reset password error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Update Profile

router.put('/update-profile', express.json(), async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ success: false, error: 'No token provided' });
        }

        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, JWT_SECRET);

        const teacher = await Teacher.findById(decoded.id);
        if (!teacher) {
            return res.status(404).json({ success: false, error: 'Teacher not found' });
        }

        const { name, email, userId, currentPassword, newPassword } = req.body;

        // Verify current password
        if (!currentPassword) {
            return res.status(400).json({ success: false, error: 'Current password is required to save changes' });
        }

        const isMatch = await bcrypt.compare(currentPassword, teacher.password);
        if (!isMatch) {
            return res.status(401).json({ success: false, error: 'Current password is incorrect' });
        }

        // Check uniqueness if email or userId changed
        if (email && email !== teacher.email) {
            const emailExists = await Teacher.findOne({ email, _id: { $ne: teacher._id } });
            if (emailExists) {
                return res.status(400).json({ success: false, error: 'Email already in use by another account' });
            }
            teacher.email = email;
        }

        if (userId && userId !== teacher.userId) {
            const userIdExists = await Teacher.findOne({ userId, _id: { $ne: teacher._id } });
            if (userIdExists) {
                return res.status(400).json({ success: false, error: 'User ID already taken' });
            }
            teacher.userId = userId;
        }

        if (name) teacher.name = name;

        // Update password if provided
        if (newPassword) {
            if (newPassword.length < 5) {
                return res.status(400).json({ success: false, error: 'New password must be at least 5 characters' });
            }
            const salt = await bcrypt.genSalt(10);
            teacher.password = await bcrypt.hash(newPassword, salt);
        }

        await teacher.save();

        // Generate new token
        const newToken = jwt.sign(
            { id: teacher._id, userId: teacher.userId },
            JWT_SECRET,
            {}
        );

        res.json({
            success: true,
            message: 'Profile updated successfully',
            token: newToken,
            teacher: {
                name: teacher.name,
                email: teacher.email,
                userId: teacher.userId
            }
        });
    } catch (error) {
        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({ success: false, error: 'Invalid token' });
        }
        console.error('Update profile error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

export default router;
