import express from "express";
import { authorizeRoles, isAutheticated } from "../middleware/auth";
import { createOrder, getAllOrdersAdmin, newPayment, sendStripePublishableKey,  } from "../controllers/order.controller";
import { updateAccessToken } from "../controllers/user.controller";
const orderRouter = express.Router();

orderRouter.post('/create-order', updateAccessToken, isAutheticated, createOrder);

orderRouter.get('/get-all-orders', updateAccessToken, isAutheticated, authorizeRoles("admin"), getAllOrdersAdmin);

orderRouter.get('/payment/stripepublishablekey', sendStripePublishableKey);

orderRouter.post('/payment', isAutheticated, newPayment);

export default orderRouter;