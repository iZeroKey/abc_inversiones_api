import { Router } from "express";
import { authenticate } from "../../middleware/auth.middleware.js";
import { authorize } from "../../middleware/role.middleware.js";
import * as controller from "./reports.controller.js";

const router = Router();

/**
 * @route   GET /api/v1/reports/statement
 * @route   GET /api/v1/reports/statement/:clientId
 * @desc    Estado de cuenta de un cliente. Sin :clientId, devuelve el del usuario actual.
 * @access  Private (Client para sí mismo, Admin para cualquiera)
 */
router.get("/statement", authenticate, authorize(["admin", "client"]), controller.getClientStatement);
router.get("/statement/:clientId", authenticate, authorize(["admin", "client"]), controller.getClientStatement);

/**
 * @route   GET /api/v1/reports/portfolio
 * @route   GET /api/v1/reports/portfolio/:investorId
 * @desc    Portafolio de inversiones. Sin :investorId, devuelve el del usuario actual.
 * @access  Private (Investor para sí mismo, Admin para cualquiera)
 */
router.get("/portfolio", authenticate, authorize(["admin", "investor"]), controller.getInvestorPortfolio);
router.get("/portfolio/:investorId", authenticate, authorize(["admin", "investor"]), controller.getInvestorPortfolio);

/**
 * @route   GET /api/v1/reports/dashboard
 * @desc    Dashboard global de administración con estadísticas.
 * @access  Private (Admin, Owner)
 */
router.get("/dashboard", authenticate, authorize(["admin"]), controller.getAdminDashboard);

export { router as reportsRoutes };
