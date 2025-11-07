import Paper from "../models/Paper.js";

export const savePaper = async (req, res) => {
  try {
    const paper = new Paper(req.body);
    const saved = await paper.save();
    res.status(201).json(saved);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getAllPapers = async (req, res) => {
  try {
    const papers = await Paper.find();
    res.json(papers);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
