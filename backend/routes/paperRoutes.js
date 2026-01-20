import express from "express";
import { savePaper, getAllPapers, getPaperById } from "../controllers/paperController.js";

const router = express.Router();

router.post("/save", savePaper);
router.get("/", getAllPapers);
router.get("/:id", getPaperById);

export default router;
