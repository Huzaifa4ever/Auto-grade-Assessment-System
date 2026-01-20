import StudentTable from "../models/StudentCsv.js";

export const uploadStudentTable = async (req, res) => {
  try {
    const { name, originalFileName, students } = req.body;

    if (!name || !Array.isArray(students)) {
      return res
        .status(400)
        .json({ message: "Name and students array are required" });
    }

    const normalizedStudents = students
      .map((s) => ({
        cmsId: (s.cmsId || "").toString().trim(),
        name: (s.name || "").toString().trim(),
      }))
      .filter((s) => s.name);

    if (normalizedStudents.length === 0) {
      return res
        .status(400)
        .json({ message: "No valid students found in uploaded data" });
    }

    normalizedStudents.sort((a, b) =>
      a.name.localeCompare(b.name, undefined, { sensitivity: "base" })
    );

    const table = new StudentTable({
      name,
      originalFileName,
      students: normalizedStudents,
    });
    const saved = await table.save();
    res.status(201).json(saved);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getStudentTables = async (req, res) => {
  try {
    const files = await StudentTable.find().sort({ createdAt: -1 });
    res.json(files);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
