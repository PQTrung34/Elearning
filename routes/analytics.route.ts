import express from "express";
import { authorizeRoles, isAutheticated } from "../middleware/auth";
import { getCourseAnalytics, getOrderAnalytics, getUserAnalytics } from "../controllers/analytics.controller";
const analyticsRouter = express.Router();

analyticsRouter.get('/get-user-analytics', isAutheticated, authorizeRoles("admin"), getUserAnalytics);

analyticsRouter.get('/get-course-analytics', isAutheticated, authorizeRoles("admin"), getCourseAnalytics);

analyticsRouter.get('/get-order-analytics', isAutheticated, authorizeRoles("admin"), getOrderAnalytics);

export default analyticsRouter;