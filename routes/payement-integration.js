const express = require("express");
const router = express.Router();
const Subscription = require("../models/subscription.model");
const User = require("../models/user.reg.model");

const SSLCommerzPayment = require("sslcommerz-lts");
const { ObjectId } = require("mongodb");
require("dotenv").config();

const STORE_ID = process.env.STORE_ID;
const STORE_PASSWORD = process.env.STORE_PASSWORD;

const is_live = false;
let sslData;

// Helper to calculate expiration date
const calculateExpirationDate = (subscriptionType) => {
  const now = new Date();
  if (subscriptionType === "daily") return new Date(now.setDate(now.getDate() + 1));
  if (subscriptionType === "weekly") return new Date(now.setDate(now.getDate() + 7));
  if (subscriptionType === "monthly") return new Date(now.setMonth(now.getMonth() + 1));
  if (subscriptionType === "yearly") return new Date(now.setFullYear(now.getFullYear() + 1));
  return null;
};

// Route to check subscription status
router.get("/subscription/status/:email", async (req, res) => {
  const { email } = req.params;

  try {
    const user = await Subscription.findOne({ email });
    if (!user || !user.subscription || !user.subscription.expiration) {
      return res.status(200).json({ message: "No subscription found" });
    }

    res.status(200).json({
      message: "Subscription is active",
      expirationDate: user.subscription.expiration,
    });
  } catch (error) {
    console.error("Error checking subscription:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

// Route to handle payment initiation
router.post("/payment", async (req, res) => {
  const { email, subscriptionType, amount } = req.body;

  try {
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (!["daily", "weekly", "monthly", "yearly"].includes(subscriptionType)) {
      return res.status(400).json({ message: "Invalid subscription type" });
    }

    const tran_id = new ObjectId().toString();

    const data = {
      total_amount: amount,
      currency: "BDT",
      tran_id,
      success_url: `https://tutorcampbackend.onrender.com/api/payment/success?val_id=${tran_id}`,
      fail_url: "https://tutorcampbackend.onrender.com/api/payment/fail",
      cancel_url: "https://tutorcampbackend.onrender.com/api/payment/cancel",
      ipn_url: "https://tutorcampbackend.onrender.com/payment/ipn",
      shipping_method: "Courier",
      product_name: `Subscription - ${subscriptionType}`,
      product_category: "Service",
      product_profile: "general",
      cus_name: user.fname+user.lname || "Customer Name",
      cus_email: user.email,
      cus_add1: user.address || "Dhaka",
      cus_city: "Dhaka",
      cus_state: "Dhaka",
      cus_postcode: "1000",
      cus_country: "Bangladesh",
      cus_phone: user.phone || "01711111111",
      ship_name: user.fname+user.lname || "Customer Name",
      ship_add1: "Dhaka",
      ship_city: "Dhaka",
      ship_state: "Dhaka",
      ship_postcode: 1000,
      ship_country: "Bangladesh",
    };

    console.log("Data sent to SSLCommerz:", data);
    sslData=data;

    const sslcz = new SSLCommerzPayment(STORE_ID, STORE_PASSWORD, is_live);
    const apiResponse = await sslcz.init(data);

    const { GatewayPageURL } = apiResponse;

    if (!GatewayPageURL) {
      return res.status(500).json({ message: "Failed to initialize payment" });
    }

    res.status(200).json({ url: GatewayPageURL });
  } catch (error) {
    console.error("Error processing payment:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

// Route to handle payment success and generate val_id
router.post("/payment/success", async (req, res) => {
  const { val_id,amount } = req.body;
  console.log(req.body,"ssl")

  if (!val_id) {
    return res.status(400).json({ message: "Validation ID (val_id) is required" });
  }

  const sslcz = new SSLCommerzPayment(STORE_ID, STORE_PASSWORD, is_live);

  try {
    // Log val_id for debugging
    console.log("Validating transaction with val_id:", val_id);

    const validationData = await sslcz.validate({ val_id });

    // Log the response from SSLCommerz
    // console.log("Validation Data:", validationData);

    if (validationData.status === "VALID") {
      const { cus_email, product_name } = validationData;
      console.log(validationData,"validationData")
     // Determine subscription type based on amount
    let subscriptionType = "";
    let expirationDate = null;

    if (amount.trim() === "100.00") {
      subscriptionType = "daily";
      expirationDate = calculateExpirationDate("daily");
    } else if (amount.trim() === "500.00") {
      subscriptionType = "weekly";
      expirationDate = calculateExpirationDate("weekly");
    } else if (amount.trim() === "2000.00") {
      subscriptionType = "monthly";
      expirationDate = calculateExpirationDate("monthly");
    } else if (amount.trim() === "20000.00") {
      subscriptionType = "yearly";
      expirationDate = calculateExpirationDate("yearly");
    } else {
      return res.status(400).json({ message: "Invalid amount" });
    }

    // Update subscription in the database
    await Subscription.updateOne(
      { email: sslData.cus_email },
      {
        $set: {
          subscription: {
            type: subscriptionType,
            expiration: expirationDate,
          },
        },
      },
      { upsert: true }
    );

     // Redirect to the success page
     return res.redirect(`http://localhost:3000/#/payment-success?val_id=${val_id}&status=success`);
    } else {
      return res.status(400).json({ message: "Invalid payment", details: validationData });
    }
  } catch (error) {
    console.error("Error in payment success handling:", error);
    res.status(500).json({ message: "Internal Server Error", error: error.message });
  }
});
router.post("/payment/fail", async (req, res) => {
  return res.redirect(`http://localhost:3000/#/payment-fail`);
 
});

module.exports = router;
