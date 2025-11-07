import express from "express";
import { savePaper, getAllPapers } from "../controllers/paperController.js";

const router = express.Router();

router.post("/save", savePaper);
router.get("/", getAllPapers);

export default router;
