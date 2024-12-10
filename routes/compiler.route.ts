import express from "express";
import { updateAccessToken } from "../controllers/user.controller";
import { isAutheticated } from "../middleware/auth";
import { addTestCase, executeJdoodle, executeCode, executeTestCases, executePiston } from "../controllers/compiler.controller";
const compilerRouter = express.Router();

compilerRouter.post('/compiler', executeCode);

compilerRouter.post('/add-testcase', addTestCase);

compilerRouter.post('/run-testcase', isAutheticated, updateAccessToken,  executeTestCases);

compilerRouter.post('/run', executeJdoodle) // test jdoodle

compilerRouter.post('/run-piston', isAutheticated, updateAccessToken, executePiston)

export default compilerRouter;