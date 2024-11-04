import { Request, Response, NextFunction } from "express";
import { CatchAsyncError } from "../middleware/catchAsyncError";
import ErrorHandler from "../utils/ErrorHandler";
import OrderModel, {IOrder} from "../models/order.model";
import userModel from "../models/user.model";
import CourseModel from "../models/course.model";
import path from "path";
import ejs from "ejs";
import sendMail from "../utils/sendMail";
import NotificationModel from "../models/notification.model";
import { getAllOrdersService, newOrder } from "../services/order.service";

// create order
export const createOrder = CatchAsyncError(async(req: Request, res: Response, next: NextFunction) => {
    try {
        const {courseId, payment_info} = req.body as IOrder;
        const user = await userModel.findById(req.user?._id);
        const courseExist = user?.courses.some((course: any) => course._id.toString === courseId);
        if (courseExist) {
            return next(new ErrorHandler("You have already purchased this course",400));
        }

        const course = await CourseModel.findById(courseId);
        if (!course) {
            return next(new ErrorHandler("Course not found",400));
        }
        
        const data:any = {
            courseId: course._id,
            userId: user?._id
        };

        const mailData = {
            order: {
                _id: course._id.toString().slice(0,6),
                name: course.name,
                price: course.price,
                data: new Date().toLocaleDateString('en-US', {year: 'numeric', month: 'long', day: 'numeric'})
            }
        }
        const html = await ejs.renderFile(path.join(__dirname, "../mails/order-confirmation.ejs"), {order: mailData});
        try {
            if (user) {
                await sendMail({
                    email: user.email,
                    subject: "Order Confimation",
                    template: "order-confirmation.ejs",
                    data: mailData
                });
            }
        } catch (error) {
            return next(new ErrorHandler(error.message,400));
        }
        
        user?.courses.push({courseId});
        await user?.save();
        const notification = await NotificationModel.create({
            user: user?._id,
            title: "New Order",
            message: `You have a new order from ${course?.name}`
        });
        
        course.purchased += 1
        await course.save();
        newOrder(data, res, next);
    } catch (error) {
        return next(new ErrorHandler(error.message,400));
    }
})

// get all orders - only for admin
export const getAllOrdersAdmin = CatchAsyncError(async(req: Request, res: Response, next: NextFunction) => {
    try {
        getAllOrdersService(res);
    } catch (error) {
        return next(new ErrorHandler(error.message,400));
    }
})