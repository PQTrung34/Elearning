require('dotenv').config();
import { Request, Response, NextFunction } from 'express';
import { CatchAsyncError } from '../middleware/catchAsyncError';
import ErrorHandler from '../utils/ErrorHandler';
const axios = require('axios');
const crypto = require('crypto');
import sendMailUtil from "../utils/sendMail";
import ejs from "ejs";
import CourseModel from '../models/course.model';
import userModel from '../models/user.model';
import progressModel from '../models/progress.model';
import path from 'path';
import { newOrder } from '../services/order.service';
import { redis } from "../utils/redis";
import NotificationModel from '../models/notification.model';

// payOS
const PayOS = require('@payos/node');
const payOS = new PayOS(process.env.PAYOS_CLIENT_ID, process.env.PAYOS_API_KEY,
              process.env.PAYOS_CHECKSUM_KEY)

export const createPaymentLink = CatchAsyncError(async(req: Request, res: Response, next: NextFunction) => {
  try {
    const {amount, description} = req.body;
    const orderCode = Number(String(new Date().getTime()).slice(-6));
    const returnUrl = 'https://dc01-171-251-212-11.ngrok-free.app/api/v1/payment-status';
    const cancelUrl = 'https://dc01-171-251-212-11.ngrok-free.app/api/v1/cancel-payment';
    const rawSignature = 'amount=' + amount + '&descripton=' + description + '&orderCode=' + orderCode + '&returnUrl=' + returnUrl + '&cancelUrl=' + cancelUrl;
    const signature = crypto.createHmac('sha256', process.env.PAYOS_CHECKSUM_KEY)
      .update(rawSignature)
      .digest('hex');
    const paymentInfo = {
      amount: amount,
      description: description,
      orderCode: orderCode,
      returnUrl: returnUrl,
      cancelUrl: cancelUrl,
      signature: signature
    }

    const paymentLink = await payOS.createPaymentLink(paymentInfo);
    
    res.status(200).json({
      success: true,
      paymentLink: paymentLink
    })
  } catch (error) {
    return next(new ErrorHandler(error.message, 400));
  }
})

export const paymentStatus = CatchAsyncError(async(req: Request, res: Response, next: NextFunction) => {
  try {
    const order = await payOS.getPaymentLinkInformation(req.params.id);
    if (!order) {
      return new ErrorHandler('Order not found', 400);
    }

    res.status(200).json({
      success: true,
      order: order
    })
  } catch (error) {
    return next(new ErrorHandler(error.message, 400));
  }
})

export const cancelPayment = CatchAsyncError(async(req: Request, res: Response, next: NextFunction) => {
  try {
    const cancelPayment = await payOS.cancelPaymentLink(req.params.id);
    if (!cancelPayment) {
      return new ErrorHandler('Order not found', 400);
    }

    res.status(200).json({
      'success': true,
      order: cancelPayment
    })
  } catch (error) {
    return next(new ErrorHandler(error.message, 400));
  }
})

export const confirmWebhook = CatchAsyncError(async(req: Request, res: Response, next: NextFunction) => {
  try {
    const {webhookUrl} = req.body;
    await payOS.confirmWebhook(webhookUrl);
    res.status(200).json({
      'success': true
    })
  } catch (error) {
    return next(new ErrorHandler(error.message, 400));
  }
})

// -----------------------------------------------------------------------------------
// Momo
// tạo link thanh toán
export const createPayment = CatchAsyncError(async(req: Request, res: Response, next: NextFunction) => {
  try {
    const {amountInfo, description, courseId} = req.body;
    const userId = req.user?._id;
    const user = await userModel.findById(userId);
    const courseExist = user?.courses.some((course: any) => course.courseId.toString() === courseId);
    if (courseExist) {
        return next(new ErrorHandler("You have already purchased this course",400));
    }
    //parameters
    const accessKey = process.env.MOMO_ACCESS_KEY;
    const secretKey = process.env.MOMO_SECRET_KEY;
    const orderInfo = description;
    const partnerCode = process.env.MOMO_PARTNER_CODE;
    // const redirectUrl = 'https://webhook.site/b3088a6a-2d17-4f8d-a383-71389a6c600b'; // link web
    const redirectUrl = 'https://google.com'; // link chuyển hướng sau khi thanh toán thành công
    // public locallhost:8000 = ngrok
    const ipnUrl = 'https://c5f3-171-251-212-11.ngrok-free.app/api/v1/check-payment'; // public localhost = ngrok
    const requestType = "payWithMethod";
    const amount = amountInfo;
    const orderId = partnerCode + new Date().getTime();
    const requestId = orderId;
    const extraData = `${courseId},${userId}`;
    const orderGroupId ='';
    const autoCapture =true;
    const lang = 'vi';

    //before sign HMAC SHA256 with format
    //accessKey=$accessKey&amount=$amount&extraData=$extraData&ipnUrl=$ipnUrl&orderId=$orderId&orderInfo=$orderInfo&partnerCode=$partnerCode&redirectUrl=$redirectUrl&requestId=$requestId&requestType=$requestType
    const rawSignature = "accessKey=" + accessKey + "&amount=" + amount + "&extraData=" + extraData + "&ipnUrl=" + ipnUrl + "&orderId=" + orderId + "&orderInfo=" + orderInfo + "&partnerCode=" + partnerCode + "&redirectUrl=" + redirectUrl + "&requestId=" + requestId + "&requestType=" + requestType;
    //puts raw signature
    // console.log("--------------------RAW SIGNATURE----------------")
    // console.log(rawSignature)
    //signature
    const signature = crypto.createHmac('sha256', secretKey)
        .update(rawSignature)
        .digest('hex');
    // console.log("--------------------SIGNATURE----------------")
    // console.log(signature)

    //json object send to MoMo endpoint
    const requestBody = JSON.stringify({
        partnerCode : process.env.MOMO_PARTNER_CODE,
        partnerName : "Test",
        storeId : "MomoTestStore",
        requestId : requestId,
        amount : amount,
        orderId : orderId,
        orderInfo : orderInfo,
        redirectUrl : redirectUrl,
        ipnUrl : ipnUrl,
        lang : lang,
        requestType: requestType,
        autoCapture: autoCapture,
        extraData : extraData,
        orderGroupId: orderGroupId,
        signature : signature
    });
    
    // options object
    const options = {
      method: 'POST',
      url: 'https://test-payment.momo.vn/v2/gateway/api/create', // link test
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(requestBody),
      },
      data: requestBody
    }

    const result = await axios(options);

    res.status(200).json({
      'success': true,
      data: result.data
    })
  } catch (error) {
    return next(new ErrorHandler(error.message, 400));
  }
})

export const checkPayment = CatchAsyncError(async(req: Request, res: Response, next: NextFunction) => {
  try {
    console.log('check payment');
    console.log(req.body);
    // res.status(200).json({
    //   data: req.body
    // })

    const resultCode = req.body.resultCode;
    const courseId = req.body.extraData.split(',')[0];
    const userId = req.body.extraData.split(',')[1];
    const user = await userModel.findById(userId);
    if (!user) {
      console.log("User not found");
      // return next(new ErrorHandler("User not found",400));
    }
    // const courseExist = user?.courses.some((course: any) => course._id.toString === courseId);
    // if (courseExist) {
    //     return next(new ErrorHandler("You have already purchased this course",400));
    // }

    const course = await CourseModel.findById(courseId);
    if (!course) {
        console.log("Course not found");
        // return next(new ErrorHandler("Course not found",400));
    }
    if (resultCode === 0) {
      const data:any = {
        courseId: courseId,
        userId: userId
      };

      const mailData = {
          order: {
              _id: courseId.toString().slice(0,6),
              name: course.name,
              price: course.price,
              data: new Date().toLocaleDateString('en-US', {year: 'numeric', month: 'long', day: 'numeric'})
          }
      }
      const html = await ejs.renderFile(path.join(__dirname, "../mails/order-confirmation.ejs"), {order: mailData});
      try {
        if (user) {
            await sendMailUtil({
                email: user.email,
                subject: "Order Confimation",
                template: "order-confirmation.ejs",
                data: mailData
            });
        }
      } catch (error) {
          return next(new ErrorHandler(error.message,400));
      }
      // console.log('Gửi mail')
      const progressData = {
        courseId: courseId,
        userId: userId,
        lesson: [],
      }
      // console.log('Progress')
      user.courses.push({courseId});
      await progressModel.create(progressData);
      await redis.set(req.user?._id, JSON.stringify(user));
      await user.save();
      const notification = await NotificationModel.create({
          user: userId,
          title: "New Order",
          message: `You have a new order from ${course?.name}`
      });
      
      course.purchased = course.purchased + 1;
      await course.save();
      console.log('Thanh toán thành công');
      newOrder(data, res, next);
      
      // res.status(200).json({
      //   'success': true,
      //   'message': "Purchase successfully"
      // })
    }
    else {
      console.log('Thanh toán thất bại');
      // return next(new ErrorHandler('Purchase failed', 400));
    }
  }
  catch (error) {
    return next(new ErrorHandler(error.message, 400));
  }
})

export const transactionStatus = CatchAsyncError(async(req: Request, res: Response, next: NextFunction) => {
  try {
    const {orderId} = req.body;
    const accessKey = process.env.MOMO_ACCESS_KEY;
    const secretKey = process.env.MOMO_SECRET_KEY;
    const partnerCode = process.env.MOMO_PARTNER_CODE;
    
    const rawSignature = `accessKey=${accessKey}&orderId=${orderId}&partnerCode=${partnerCode}&requestId=${orderId}`

    const signature = crypto.createHmac('sha256', secretKey)
        .update(rawSignature)
        .digest('hex');
      
      const requestBody = JSON.stringify({
        partnerCode: partnerCode,
        requestId: orderId,
        orderId: orderId,
        signature: signature,
        lang: 'vi'
      })

      // options for axios
      const options = {
        method: 'POST',
        url: 'https://test-payment.momo.vn/v2/gateway/api/query', // link test
        headers: {
          'Content-Type': 'application/json',
        },
        data: requestBody
      }

      const result = await axios(options).catch(error => console.log(error));
      
      res.status(200).json({
        'success': true,
        data: result.data
      })
  } catch (error) {
    return next(new ErrorHandler(error.message, 400));
  }
})

function sendMail(arg0: { email: any; subject: string; template: string; data: { order: { _id: any; name: any; price: any; date: string; }; }; }) {
  throw new Error('Function not implemented.');
}
