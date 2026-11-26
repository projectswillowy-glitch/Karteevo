import { Router } from "express";
import {
  createRazorpayOrder,
  verifyRazorpayPayment,
} from "../controllers/razorpayController.js";
import { optionalAuthMiddleware } from "../middleware/authMiddleware.js";

const router = Router();

router.use(optionalAuthMiddleware);

router.post("/create-order", createRazorpayOrder);
router.post("/verify", verifyRazorpayPayment);

export default router;
