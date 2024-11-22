import express from 'express';
import { authorizeRoles, isAutheticated } from '../middleware/auth';
import { getProgress, updateProgress } from '../controllers/progress.controller';
import { updateAccessToken } from '../controllers/user.controller';
const progressRouter = express.Router();

progressRouter.post('/update-progress', isAutheticated, updateAccessToken, updateProgress);

progressRouter.post('/get-progress', isAutheticated, updateAccessToken, getProgress);

export default progressRouter;