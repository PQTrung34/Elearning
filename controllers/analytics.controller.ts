import { Request, Response, NextFunction } from "express";
import ErrorHandler from "../utils/ErrorHandler";
import { CatchAsyncError } from "../middleware/catchAsyncError";
import { generateLast12MonthData } from "../utils/analytics";
import userModel from "../models/user.model";
import CourseModel from "../models/course.model";
import OrderModel from "../models/order.model";

// get user analytics - only for admin
export const getUserAnalytics = CatchAsyncError(async(req: Request, res: Response, next: NextFunction) => {
    try {
        const users = await generateLast12MonthData(userModel);

        res.status(200).json({
            success: true,
            users
        })
    } catch (error) {
        return next(new ErrorHandler(error.message,400));
    }
})

// get course analytics - only for admin
export const getCourseAnalytics = CatchAsyncError(async(req: Request, res: Response, next: NextFunction) => {
    try {
        const courses = await generateLast12MonthData(CourseModel);

        res.status(200).json({
            success: true,
            courses
        })
    } catch (error) {
        return next(new ErrorHandler(error.message,400));
    }
})

// get order analytics - only for admin
export const getOrderAnalytics = CatchAsyncError(async(req: Request, res: Response, next: NextFunction) => {
    try {
        const orders = await generateLast12MonthData(OrderModel);

        res.status(200).json({
            success: true,
            orders
        })
    } catch (error) {
        return next(new ErrorHandler(error.message,400));
    }
})