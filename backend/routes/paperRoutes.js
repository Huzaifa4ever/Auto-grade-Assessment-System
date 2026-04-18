import express from "express";
import { savePaper, getAllPapers, getPaperById } from "../controllers/paperController.js";
import authMiddleware from "../middleware/authMiddleware.js";

const router = express.Router();

router.post("/save", authMiddleware, savePaper);
router.get("/", authMiddleware, getAllPapers);
router.get("/:id", authMiddleware, getPaperById);

export default router;
