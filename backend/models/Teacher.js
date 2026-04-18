import mongoose from "mongoose";

const teacherSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    userId: { type: String, required: true, unique: true },
    password: { type: String, required: true, minlength: 5 },
    resetCode: { type: String, default: null },
    resetCodeExpires: { type: Date, default: null }
}, {
    timestamps: true
});

const Teacher = mongoose.model("Teacher", teacherSchema);

export default Teacher;
