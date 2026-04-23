import { Router } from "express";
import authRoutes from "../modules/auth/auth.routes.js";
import { usersRoutes } from "../modules/users/users.routes.js";
import { accessRequestsRoutes } from "../modules/access-requests/access-requests.routes.js";
import { loansRoutes } from "../modules/loans/loans.routes.js";
import { paymentsRoutes } from "../modules/payments/payments.routes.js";
import { paymentVouchersRoutes } from "../modules/payment-vouchers/payment-vouchers.routes.js";
import { notificationsRoutes } from "../modules/notifications/notifications.routes.js";
import { auditRoutes } from "../modules/audit/audit.routes.js";

const router = Router();

// Health check alineado con el test
router.get("/health", (req, res) => {
  res.status(200).json({
    success: true,
    message: "API is running",
    data: { status: "ok" },
    meta: { timestamp: new Date().toISOString() }
  });
});

router.use("/auth", authRoutes);
router.use("/users", usersRoutes);
router.use("/access-requests", accessRequestsRoutes);
router.use("/loans", loansRoutes);
router.use("/payments", paymentsRoutes);
router.use("/payment-vouchers", paymentVouchersRoutes);
router.use("/notifications", notificationsRoutes);
router.use("/audit-logs", auditRoutes);

export default router;
export { router as v1Routes };
