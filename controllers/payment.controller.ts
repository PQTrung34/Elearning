require('dotenv').config();
import { Request, Response, NextFunction } from 'express';
import { CatchAsyncError } from '../middleware/catchAsyncError';
import ErrorHandler from '../utils/ErrorHandler';
import { request } from 'axios';
const axios = require('axios');
const crypto = require('crypto');
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


// // tạo link thanh toán
// export const createPayment = CatchAsyncError(async(req: Request, res: Response, next: NextFunction) => {
//   try {
//     //parameters
//     var accessKey = process.env.MOMO_ACCESS_KEY;
//     var secretKey = process.env.MOMO_SECRET_KEY;
//     var orderInfo = 'pay with MoMo';
//     var partnerCode = process.env.MOMO_PARTNER_CODE;
//     var redirectUrl = 'https://webhook.site/b3088a6a-2d17-4f8d-a383-71389a6c600b'; // link web
//     var ipnUrl = 'https://dc01-171-251-212-11.ngrok-free.app/checkPayment'; // public localhost = ngrok
//     var requestType = "payWithMethod";
//     var amount = '50000';
//     var orderId = partnerCode + new Date().getTime();
//     var requestId = orderId;
//     var extraData ='';
//     var orderGroupId ='';
//     var autoCapture =true;
//     var lang = 'vi';

//     //before sign HMAC SHA256 with format
//     //accessKey=$accessKey&amount=$amount&extraData=$extraData&ipnUrl=$ipnUrl&orderId=$orderId&orderInfo=$orderInfo&partnerCode=$partnerCode&redirectUrl=$redirectUrl&requestId=$requestId&requestType=$requestType
//     var rawSignature = "accessKey=" + accessKey + "&amount=" + amount + "&extraData=" + extraData + "&ipnUrl=" + ipnUrl + "&orderId=" + orderId + "&orderInfo=" + orderInfo + "&partnerCode=" + partnerCode + "&redirectUrl=" + redirectUrl + "&requestId=" + requestId + "&requestType=" + requestType;
//     //puts raw signature
//     console.log("--------------------RAW SIGNATURE----------------")
//     console.log(rawSignature)
//     //signature
//     const crypto = require('crypto');
//     var signature = crypto.createHmac('sha256', secretKey)
//         .update(rawSignature)
//         .digest('hex');
//     console.log("--------------------SIGNATURE----------------")
//     console.log(signature)

//     //json object send to MoMo endpoint
//     const requestBody = JSON.stringify({
//         partnerCode : process.env.MOMO_PARTNER_CODE,
//         partnerName : "Test",
//         storeId : "MomoTestStore",
//         requestId : requestId,
//         amount : amount,
//         orderId : orderId,
//         orderInfo : orderInfo,
//         redirectUrl : redirectUrl,
//         ipnUrl : ipnUrl,
//         lang : lang,
//         requestType: requestType,
//         autoCapture: autoCapture,
//         extraData : extraData,
//         orderGroupId: orderGroupId,
//         signature : signature
//     });
    
//     // options object
//     const options = {
//       method: 'POST',
//       url: 'https://test-payment.momo.vn/v2/gateway/api/create', // link test
//       headers: {
//         'Content-Type': 'application/json',
//         'Content-Length': Buffer.byteLength(requestBody),
//       },
//       data: requestBody
//     }

//     const result = await axios(options);

//     res.status(200).json({
//       'success': true,
//       data: result.data
//     })
//   } catch (error) {
//     return next(new ErrorHandler(error.message, 400));
//   }
// })

// export const checkPayment = CatchAsyncError(async(req: Request, res: Response, next: NextFunction) => {
//   try {
//     res.status(200).json({
//       data: req.body
//     })
//   } catch (error) {
//     return next(new ErrorHandler(error.message, 400));
//   }
// })

// export const transactionStatus = CatchAsyncError(async(req: Request, res: Response, next: NextFunction) => {
//   try {
//     const {orderId} = req.body;
    
//     const rawSignature = `accesskey=${process.env.MOMO_ACCESS_KEY}&orderid=${orderId}&partnercode=${process.env.MOMO_PARTNER_CODE}&requestid=${orderId}`;

//     const signature = crypto.
//       createHmac('sha256', process.env.MOMO_SECRET_KEY)
//       .update(rawSignature)
//       .digest('hex');
      
//       const requestBody = JSON.stringify({
//         partnerCode: process.env.MOMO_PARTNER_CODE,
//         requestId: orderId,
//         orderId: orderId,
//         signature: signature,
//         lang: 'vi'
//       })

//       // options for axios
//       const options = {
//         method: 'POST',
//         url: 'https://test-payment.momo.vn/v2/gateway/api/query', // link test
//         headers: {
//           'Content-Type': 'application/json',
//         },
//         data: requestBody
//       }

//       const result = await axios(options);
      
//       res.status(200).json({
//         'success': true,
//         data: result.data
//       })
//   } catch (error) {
//     return next(new ErrorHandler(error.message, 400));
//   }
// })