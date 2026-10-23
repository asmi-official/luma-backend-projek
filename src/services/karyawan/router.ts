import { Router } from "express";
import { authenticate } from "../../middlewares/authenticate";
import {
  createKaryawan,
  deleteKaryawan,
  getAllKaryawans,
  getKaryawanById,
  resetKaryawanPassword,
  toggleKaryawanActive,
  updateKaryawan,
} from "./controller";

const router = Router();

router.get("/", getAllKaryawans);
router.post("/", authenticate, createKaryawan);
router.get("/:id", authenticate, getKaryawanById);
router.put("/:id", authenticate, updateKaryawan);
router.patch("/:id/toggle-active", authenticate, toggleKaryawanActive);
router.patch("/:id/reset-password", authenticate, resetKaryawanPassword);
router.delete("/:id", authenticate, deleteKaryawan);

export default router;
