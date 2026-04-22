import { Router } from "express";
import { authenticate } from "../../middleware/auth.middleware.js";
import { authorize } from "../../middleware/role.middleware.js";
import * as controller from "./access-requests.controller.js";

const router = Router();

// POST /api/v1/access-requests
router.post("/", controller.createRequest);

// GET /api/v1/access-requests
router.get("/", authenticate, authorize(["admin"]), controller.getAllRequests);

// GET /api/v1/access-requests/:id
router.get(
  "/:id",
  authenticate,
  authorize(["admin"]),
  controller.getRequestById,
);

// PATCH /api/v1/access-requests/:id/status
router.patch(
  "/:id/status",
  authenticate,
  authorize(["admin"]),
  controller.updateStatus,
);

export { router as accessRequestsRoutes };
