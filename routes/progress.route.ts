import express from 'express';
import { authorizeRoles, isAutheticated } from '../middleware/auth';
import { getProgress, isLessonComplete, updateProgress } from '../controllers/progress.controller';
import { updateAccessToken } from '../controllers/user.controller';
const progressRouter = express.Router();

progressRouter.post('/update-progress', isAutheticated, updateAccessToken, updateProgress);

// progressRouter.post('/get-progress', isAutheticated, updateAccessToken, getProgress);

progressRouter.get('/get-progress/:courseId', isAutheticated, updateAccessToken, getProgress);

progressRouter.get('/is-complete', isAutheticated, updateAccessToken, isLessonComplete);

export default progressRouter;