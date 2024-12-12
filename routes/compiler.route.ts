import express from "express";
import { updateAccessToken } from "../controllers/user.controller";
import { isAutheticated } from "../middleware/auth";
import { addTestCase, executeCode, executeTestCases } from "../controllers/compiler.controller";
const compilerRouter = express.Router();

compilerRouter.post('/compiler', executeCode);

compilerRouter.post('/add-testcase', addTestCase);

compilerRouter.post('/run-testcase', isAutheticated, updateAccessToken,  executeTestCases);

export default compilerRouter;