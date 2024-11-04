import express from "express";
import { authorizeRoles, isAutheticated } from "../middleware/auth";
import { getNotifications } from "../controllers/notification.controller";
const notificationRouter = express.Router();

notificationRouter.get("/get-all-notifications",isAutheticated, authorizeRoles("admin"), getNotifications);

export default notificationRouter;