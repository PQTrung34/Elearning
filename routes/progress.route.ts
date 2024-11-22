import express from 'express';
import { authorizeRoles, isAutheticated } from '../middleware/auth';
import { getProgress } from '../controllers/progress.controller';
const progressRouter = express.Router();

progressRouter.post('/get-progress', isAutheticated, getProgress);

export default progressRouter;