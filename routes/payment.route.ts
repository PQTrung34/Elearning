import express from "express";
import { authorizeRoles, isAutheticated } from "../middleware/auth";
import { updateAccessToken } from "../controllers/user.controller";
import { checkPayment, createPayment, transactionStatus } from "../controllers/payment.controller";
import { cancelPayment, confirmWebhook, createPaymentLink, paymentStatus } from "../controllers/payment.controller";
const paymentRouter = express.Router();

// momo
paymentRouter.post('/create-payment', isAutheticated, updateAccessToken, createPayment);

paymentRouter.post('/check-payment', checkPayment);

paymentRouter.post('/transaction-status', isAutheticated, updateAccessToken, transactionStatus);

// payos
paymentRouter.post('/create-payment-link', isAutheticated, updateAccessToken, createPaymentLink);

paymentRouter.get('/payment-status/:id', isAutheticated, updateAccessToken, paymentStatus);

paymentRouter.get('/cancel-payment/:id', isAutheticated, updateAccessToken, cancelPayment);

paymentRouter.post('/confirm-webhook', isAutheticated, updateAccessToken, confirmWebhook);

export default paymentRouter;