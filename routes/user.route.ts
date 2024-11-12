import express from 'express';
import { registrationUser, activateUser, loginUser, logoutUser, updateAccessToken, getUserInfo, socialAuth, updateUserInfo, updateUserPassword, updateProfilePicture, getAllUsersAdmin, updateUserRole, deleteUser } from '../controllers/user.controller';
import { authorizeRoles, isAutheticated } from '../middleware/auth';
import { deleteModel } from 'mongoose';
const userRouter = express.Router()

userRouter.post('/registration', registrationUser);

userRouter.post('/activate-user', activateUser);

userRouter.post('/login', loginUser);

userRouter.get('/logout', isAutheticated, logoutUser);

userRouter.get('/refresh', updateAccessToken);

userRouter.get('/me', updateAccessToken, isAutheticated, getUserInfo);

userRouter.post('/social-auth', socialAuth);

userRouter.put('/update-user-info', updateAccessToken, isAutheticated, updateUserInfo)

userRouter.put('/update-user-password', updateAccessToken, isAutheticated, updateUserPassword)

userRouter.put('/update-user-avatar', updateAccessToken, isAutheticated, updateProfilePicture)

// userRouter.get('/get-all-users', updateAccessToken, isAutheticated, authorizeRoles("admin"), getAllUsersAdmin);

// userRouter.put('/update-user-role', updateAccessToken, isAutheticated, authorizeRoles("admin"), updateUserRole);

userRouter.get('/get-all-users', getAllUsersAdmin);

userRouter.put('/update-user-role', updateUserRole);

userRouter.delete('/delete-user/:id', updateAccessToken, isAutheticated, authorizeRoles("admin"), deleteUser);

export default userRouter;