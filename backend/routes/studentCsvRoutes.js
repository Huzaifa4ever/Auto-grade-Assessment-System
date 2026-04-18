import express from "express";
import { uploadStudentTable, getStudentTables } from "../controllers/studentCsvController.js";
import authMiddleware from "../middleware/authMiddleware.js";

const router = express.Router();

router.post("/upload", authMiddleware, uploadStudentTable);
router.get("/", authMiddleware, getStudentTables);

export default router;
