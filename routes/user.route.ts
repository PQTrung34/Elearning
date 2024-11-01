import express from 'express';
import { registrationUser, activateUser, loginUser, logoutUser, updateAccessToken } from '../controllers/user.controller';
import { authorizeRoles, isAutheticated } from '../middleware/auth';
const userRouter = express.Router()

userRouter.post('/registration', registrationUser);

userRouter.post('/activate-user', activateUser);

userRouter.post('/login', loginUser);

userRouter.get('/logout', isAutheticated, logoutUser);

userRouter.get('/refresh', updateAccessToken);

export default userRouter;