import express from "express";
import { authorizeRoles, isAutheticated } from "../middleware/auth";
import { getNotifications, updateNotification } from "../controllers/notification.controller";
import { updateAccessToken } from "../controllers/user.controller";
const notificationRouter = express.Router();

notificationRouter.get('/get-all-notifications', updateAccessToken, isAutheticated, authorizeRoles("admin"), getNotifications);

notificationRouter.put('/update-notification/:id', updateAccessToken, isAutheticated, authorizeRoles("admin"), updateNotification);

export default notificationRouter;