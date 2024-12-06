import express from "express";
import { authorizeRoles, isAutheticated } from "../middleware/auth";
import { updateAccessToken } from "../controllers/user.controller";
import { checkPayment, createPayment, transactionStatus } from "../controllers/payment.controller";

const paymentRouter = express.Router();

// momo
paymentRouter.post('/create-payment', isAutheticated, updateAccessToken, createPayment);

paymentRouter.post('/check-payment', checkPayment);

paymentRouter.post('/transaction-status', isAutheticated, updateAccessToken, transactionStatus);

export default paymentRouter;