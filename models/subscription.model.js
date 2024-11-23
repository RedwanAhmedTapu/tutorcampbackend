const mongoose = require("mongoose");

const subscriptionSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  subscription: {
    type: {
      type: String, // daily, weekly, monthly, yearly
      default: null,
    },
    expiration: {
      type: Date,
      default: null,
    },
  },
});

module.exports = mongoose.model("Subscription", subscriptionSchema);
