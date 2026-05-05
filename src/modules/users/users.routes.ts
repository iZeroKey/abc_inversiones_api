import { Router } from "express";
import * as controller from "./users.controller.js";
import { authenticate } from "../../middleware/auth.middleware.js";
import { authorize } from "../../middleware/role.middleware.js";
import { bufferAvatarUpload } from "../../middleware/stream-upload.middleware.js";

const router = Router();

/**
 * @route   GET /api/v1/users/me
 * @desc    Obtener el perfil del usuario actualmente autenticado
 * @access  Private
 */
router.get("/me", authenticate, controller.getMe);

/**
 * @route   PATCH /api/v1/users/me/avatar
 * @desc    Actualizar la foto de perfil. Acepta imagen como multipart/form-data en campo "avatar".
 *          Usa modo buffer (busboy, 2MB) con reemplazo seguro (atómico) del avatar anterior.
 * @access  Private
 */
router.patch("/me/avatar", authenticate, bufferAvatarUpload, controller.updateAvatar);

/**
 * @route   DELETE /api/v1/users/me/avatar
 * @desc    Eliminar la foto de perfil del usuario autenticado.
 *          Borra el objeto de Supabase Storage y deja avatarUrl en null.
 * @access  Private
 */
router.delete("/me/avatar", authenticate, controller.deleteAvatar);

/**
 * @route   GET /api/v1/users
 * @desc    Listar todos los usuarios registrados (Solo Admin)
 * @access  Private (Admin, Owner)
 */
router.get("/", authenticate, authorize(["admin"]), controller.getAllUsers);

/**
 * @route   GET /api/v1/users/:id
 * @desc    Obtener información detallada de un usuario por ID (Solo Admin)
 * @access  Private (Admin, Owner)
 */
router.get("/:id", authenticate, authorize(["admin"]), controller.getUserById);

/**
 * @route   PATCH /api/v1/users/:id
 * @desc    Actualizar datos de un usuario. Los usuarios solo pueden actualizarse a sí mismos, salvo el Admin.
 * @access  Private
 * @body    Self: { firstName, lastName, phone } | Admin: { firstName, lastName, phone, role, active, isOwner }
 */
router.patch("/:id", authenticate, controller.updateUser);

/**
 * @route   DELETE /api/v1/users/:id
 * @desc    Realizar un borrado lógico (soft delete) de un usuario
 * @access  Private (Admin, Owner)
 */
router.delete("/:id", authenticate, authorize(["admin"]), controller.deleteUser);

export { router as usersRoutes };
