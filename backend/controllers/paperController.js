import Paper from "../models/Paper.js";

export const savePaper = async (req, res) => {
  try {
    req.body.teacherId = req.teacherId;
    const paper = new Paper(req.body);
    const saved = await paper.save();
    res.status(201).json(saved);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getAllPapers = async (req, res) => {
  try {
    const papers = await Paper.find({ teacherId: req.teacherId });
    res.json(papers);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getPaperById = async (req, res) => {
  try {
    const paper = await Paper.findOne({ _id: req.params.id, teacherId: req.teacherId });
    if (!paper) {
      return res.status(404).json({ message: 'Paper not found' });
    }
    res.json(paper);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
