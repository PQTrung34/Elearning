require("dotenv").config();
import { Request, Response, NextFunction } from "express";
import { CatchAsyncError } from "../middleware/catchAsyncError";
import ErrorHandler from "../utils/ErrorHandler";
import {IOrder} from "../models/order.model";
import userModel from "../models/user.model";
import CourseModel from "../models/course.model";
import path from "path";
import ejs from "ejs";
import sendMail from "../utils/sendMail";
import NotificationModel from "../models/notification.model";
import { getAllOrdersService, newOrder } from "../services/order.service";
import { redis } from "../utils/redis";
import progressModel from "../models/progress.model";
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

// create order
export const createOrder = CatchAsyncError(async(req: Request, res: Response, next: NextFunction) => {
    try {
        const {courseId, payment_info} = req.body as IOrder;

        if (payment_info) {
            if ('id' in payment_info) {
                const paymentIntentId = payment_info.id;
                const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
                if (paymentIntent.status !== "succeeded") {
                    return next(new ErrorHandler("Payment not authorized",400));
                }
            }
        }
        const user = await userModel.findById(req.user?._id);
        const courseExist = user?.courses.some((course: any) => course.courseId.toString() === courseId);
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

        // let lesson = [];
        // course.courseContent?.forEach((content: any) => {
        //     let quizzes = [];
        //     content.quiz?.forEach((item: any) => {
        //         quizzes.push({
        //             quizId: item._id,
        //             status: false
        //         })
        //     })
        //     let codes = [];
        //     content.questionCode?.forEach((item: any) => {
        //         codes.push({
        //             codeId: item._id,
        //             status: false
        //         })
        //     })
        //     lesson.push({
        //         contentId: content._id,
        //         quiz: quizzes,
        //         code: codes
        //     })
        // })

        const progressData = {
            courseId: courseId,
            userId: user?._id,
            lesson: [],
            isCompleted: false,
        }
        
        user?.courses.push({courseId});
        await progressModel.create(progressData);
        await redis.set(req.user?._id, JSON.stringify(user));
        await user?.save();
        const notification = await NotificationModel.create({
            user: user?._id,
            title: "New Order",
            message: `You have a new order from ${course?.name}`
        });
        
        course.purchased = course.purchased + 1;
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


// send stripe publishable key
export const sendStripePublishableKey = CatchAsyncError(async(req: Request, res: Response, next: NextFunction) => {
    res.status(200).json({
        publishableKey: process.env.STRIPE_PUBLISHABLE_KEY,
    })
})


// new payment
export const newPayment = CatchAsyncError(async(req: Request, res: Response, next: NextFunction) => {
    try {
        const myPayment = await stripe.paymentIntents.create({
            amount: req.body.amount,
            currency: 'USD',
            metadata: {
                company: 'ELearning',
            },
            automatic_payment_methods: {
                enabled: true,
            }
        });

        res.status(201).json({
            success: true,
            client_secret: myPayment.client_secret,
        })
    } catch (error) {
        return next(new ErrorHandler(error.message,400));
    }
})