import mongoose from 'mongoose';

const courseSchema = new mongoose.Schema({
    courseCode: {
        type: String,
        required: true,
        trim: true,
        uppercase: true,
    },
    courseName: {
        type: String,
        required: true,
        trim: true,
    },
    department: {
        type: String,
        required: true,
        trim: true,
    },
    prefix: {
        type: String,
        uppercase: true,
    },
    level: {
        type: Number,
    },
    teacherId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Teacher',
        required: true,
    },
}, {
    timestamps: true,
});

courseSchema.index({ courseCode: 1, teacherId: 1 }, { unique: true });

courseSchema.pre('save', function (next) {
    if (this.courseCode) {
        const match = this.courseCode.match(/^([A-Z]{3})\s+(\d{3})$/);
        if (match) {
            this.prefix = match[1];
            this.level = parseInt(match[2], 10);
        }
    }
    next();
});

const Course = mongoose.model('Course', courseSchema);

export default Course;
