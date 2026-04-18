import mongoose from "mongoose";

const questionResultSchema = new mongoose.Schema({
    questionKey: { type: String, required: true },
    questionText: String,
    maxMarks: { type: Number, default: 0 },
    obtainedMarks: { type: Number, default: 0 },
    feedback: { type: String, default: '' },
    studentAnswer: { type: String, default: '' },
    rubrics: [String],
    edited: { type: Boolean, default: false },
    ocrConfidence: { type: Number, default: 0 },
    llmConfidence: { type: Number, default: 0 }
});

const evaluationResultSchema = new mongoose.Schema({
    sessionId: { type: String, required: true },
    paperId: { type: mongoose.Schema.Types.ObjectId, ref: 'Paper' },
    teacherId: { type: mongoose.Schema.Types.ObjectId, ref: 'Teacher' },
    cmsId: { type: String, required: true },
    studentName: { type: String, default: '' },
    section: { type: String, default: '' },
    courseCode: { type: String, default: '' },
    status: {
        type: String,
        enum: ['pending', 'evaluating', 'completed', 'error'],
        default: 'pending'
    },
    totalMarks: { type: Number, default: 0 },
    obtainedMarks: { type: Number, default: 0 },
    questions: [questionResultSchema],
    ocrAccuracy: { type: Number, default: 0 },
    llmAccuracy: { type: Number, default: 0 },
    errorMessage: String,
    evaluatedAt: Date,
    editedAt: Date
}, {
    timestamps: true
});

evaluationResultSchema.index({ sessionId: 1, cmsId: 1 }, { unique: true });
evaluationResultSchema.index({ sessionId: 1 });

const EvaluationResult = mongoose.model("EvaluationResult", evaluationResultSchema);

export default EvaluationResult;
