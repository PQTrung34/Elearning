import express from "express";
import { updateAccessToken } from "../controllers/user.controller";
import { executeCode } from "../controllers/compiler.controller";
const compilerRouter = express.Router();

compilerRouter.post('/compiler', updateAccessToken, executeCode);

export default compilerRouter;