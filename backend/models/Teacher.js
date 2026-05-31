import mongoose from "mongoose";

const teacherSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    userId: { type: String, required: true, unique: true },
    password: { type: String, required: true, minlength: 5 },
    resetCode: { type: String, default: null },
    resetCodeExpires: { type: Date, default: null },
    llmConfig: {
        provider: {
            type: String,
            enum: ['cerebras-free', 'custom'],
            default: 'cerebras-free'
        },
        model: { type: String, default: 'gpt-oss-120b' },
        apiKey: { type: String, default: '' },
        endpoint: { type: String, default: '' },
        rpm: { type: Number, default: 5 },
        tpm: { type: Number, default: 30000 },
        fallbackEnabled: { type: Boolean, default: true },
        lastTested: { type: Date, default: null },
        lastStatus: { type: String, enum: ['connected', 'error', null], default: null }
    }
}, {
    timestamps: true
});

const Teacher = mongoose.model("Teacher", teacherSchema);

export default Teacher;
