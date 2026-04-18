import mongoose from "mongoose";

const studentSchema = new mongoose.Schema({
  cmsId: { type: String, required: true },
  name: { type: String, required: true },
});

const studentTableSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    originalFileName: { type: String },
    students: [studentSchema],
    teacherId: { type: mongoose.Schema.Types.ObjectId, ref: 'Teacher' },
  },
  {
    timestamps: true,
  }
);

const StudentTable = mongoose.model("StudentTable", studentTableSchema);

export default StudentTable;
