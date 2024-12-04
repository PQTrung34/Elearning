import { NextFunction, Response } from "express";
import { CatchAsyncError } from "../middleware/catchAsyncError";
import OrderModel from "../models/order.model";
import CourseModel from "../models/course.model";
import userModel from "../models/user.model";

// create new order
export const newOrder = CatchAsyncError(async(data: any, res: Response) => {
    const order = await OrderModel.create(data);
    res.status(201).json({
        success: true,
        order,
    });
});

// get all orders
export const getAllOrdersService = async(res: Response) => {
    const orders = await OrderModel.find().sort({createAt: -1});
    const results = await Promise.all(
        orders.map(async (order: any) => {
            const course = await CourseModel.findById(order.courseId);
            const user = await userModel.findById(order.userId);
            return {
                ...order.toObject(), // Chuyển Mongoose document thành object thông thường
                coursePrice: course?.price || null,
                userName: user?.name || "Unknown User",
            };
        })
    );

    res.status(201).json({
        success: true,
        results
    })
}