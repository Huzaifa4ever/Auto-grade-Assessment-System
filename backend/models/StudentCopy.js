import mongoose from "mongoose";

const studentSchema = new mongoose.Schema({
    cmsId: { type: String, required: true },
    name: String,
    section: String,
    courseCode: String,
    totalPages: { type: Number, default: 0 },
    pdfPath: String
});

const studentCopySchema = new mongoose.Schema({
    sessionId: { type: String, required: true, unique: true },
    paperId: { type: mongoose.Schema.Types.ObjectId, ref: 'Paper' },
    students: [studentSchema]
}, {
    timestamps: true
});

studentCopySchema.index({ sessionId: 1 });
studentCopySchema.index({ createdAt: -1 });

const StudentCopy = mongoose.model("StudentCopy", studentCopySchema);

export default StudentCopy;
