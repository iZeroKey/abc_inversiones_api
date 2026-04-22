import { Router } from "express";
import authRoutes from "../modules/auth/auth.routes.js";
import healthRoutes from "../modules/health/health.routes.js";
import { usersRoutes } from "../modules/users/users.routes.js";
import { accessRequestsRoutes } from "../modules/access-requests/access-requests.routes.js";
import { loansRoutes } from "../modules/loans/loans.routes.js";
import { paymentsRoutes } from "../modules/payments/payments.routes.js";
import { paymentVouchersRoutes } from "../modules/payment-vouchers/payment-vouchers.routes.js";

const v1Routes = Router();

v1Routes.use("/auth", authRoutes);
v1Routes.use("/health", healthRoutes);
v1Routes.use("/users", usersRoutes);
v1Routes.use("/access-requests", accessRequestsRoutes);
v1Routes.use("/loans", loansRoutes);
v1Routes.use("/payments", paymentsRoutes);
v1Routes.use("/payment-vouchers", paymentVouchersRoutes);

export { v1Routes };
