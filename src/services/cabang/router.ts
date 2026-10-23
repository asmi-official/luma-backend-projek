import { Router } from "express";
import { authenticate } from "../../middlewares/authenticate";
import {
  createCabang,
  getCabangFilterOptions,
  getAllCabangs,
  getCabangById,
  updateCabang,
  deleteCabang,
} from "./controller";

const router = Router();

router.post("/", authenticate, createCabang);
router.get("/filter-options", getCabangFilterOptions);
router.get("/", authenticate, getAllCabangs);
router.get("/:id", authenticate, getCabangById);
router.put("/:id", authenticate, updateCabang);
router.delete("/:id", authenticate, deleteCabang);

export default router;
