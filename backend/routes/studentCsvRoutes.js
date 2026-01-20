import express from "express";
import { uploadStudentTable, getStudentTables } from "../controllers/studentCsvController.js";

const router = express.Router();

router.post("/upload", uploadStudentTable);
router.get("/", getStudentTables);

export default router;
