import express from "express";
import { authorizeRoles, isAutheticated } from "../middleware/auth";
import { createLayout } from "../controllers/layout.controller";
const layoutRouter = express.Router();

layoutRouter.post('/create-layout', isAutheticated, authorizeRoles("admin"), createLayout);

export default layoutRouter;