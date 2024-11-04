import NotificationModel from "../models/notification.model";
import { Request, Response, NextFunction } from "express";
import { CatchAsyncError } from "../middleware/catchAsyncError";
import ErrorHandler from "../utils/ErrorHandler";

// get all notifications -- only admin
export const getNotifications = CatchAsyncError(async(req: Request, res: Response, next: NextFunction) => {
    try {
        const notifications = await NotificationModel.find();
        res.status(201).json({
            success: true,
            notifications
        });
    } catch (error) {
        return next(new ErrorHandler(error.message,400));
    }    
});

// update notifications status -- only admin
export const updateNotification = CatchAsyncError(async(req: Request, res: Response, next: NextFunction) => {
    try {
        const notification = await NotificationModel.findById(req.params.id);
        if (!notification) {
            return next(new ErrorHandler("Notification not found",400));
        } else {
            notification.status ? notification.status = "read" : notification?.status;
        }
        await notification.save();
        const notifications = await NotificationModel.find().sort({createAt: -1});
        res.status(201).json({
            success: true,
            notifications
        })
        
    } catch (error) {
        return next(new ErrorHandler(error.message,400));
    }
})