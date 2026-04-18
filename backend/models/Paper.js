import mongoose from "mongoose";

const rubricSchema = new mongoose.Schema({
  id: String,
  text: String
});

const subPartSchema = new mongoose.Schema({
  id: String,
  label: String,
  text: String,
  marks: Number,
  pages: Number,
  rubrics: [rubricSchema]
});

const partSchema = new mongoose.Schema({
  id: String,
  label: String,
  text: String,
  marks: Number,
  rubrics: [rubricSchema],
  pages: Number,
  subParts: [subPartSchema]
});

const questionSchema = new mongoose.Schema({
  id: String,
  label: String,
  text: String,
  marks: Number,
  rubrics: [rubricSchema],
  pages: Number,
  parts: [partSchema]
});
const paperSchema = new mongoose.Schema({
  name: String,
  rawText: String,
  questions: [questionSchema],
  totalMarks: Number,
  examDate: String,
  allocatedTime: String,
  className: String,
  courseName: String,
  courseCode: String,
  instructor: String,
  section: String,
  studentTableId: String,
  teacherId: { type: mongoose.Schema.Types.ObjectId, ref: 'Teacher' }
});

const Paper = mongoose.model("Paper", paperSchema);

export default Paper;
