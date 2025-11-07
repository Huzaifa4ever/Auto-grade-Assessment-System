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
  rubrics: [rubricSchema]
});

const partSchema = new mongoose.Schema({
  id: String,
  label: String,
  text: String,
  marks: Number,
  rubrics: [rubricSchema],
  subParts: [subPartSchema]
});

const questionSchema = new mongoose.Schema({
  id: String,
  label: String,
  text: String,
  marks: Number,
  rubrics: [rubricSchema],
  parts: [partSchema]
});
partSchema
const paperSchema = new mongoose.Schema({
  name: String,
  rawText: String,
  questions: [questionSchema],
  totalMarks: Number
});

const Paper = mongoose.model("Paper", paperSchema);

export default Paper;
