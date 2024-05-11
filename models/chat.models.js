const mongoose = require("mongoose");

const chatSchema = new mongoose.Schema({
  message: {
    type: String,
    required: true,
  },
  sender: {
    type: String,
    required: false,
  },
  receiver: {
    type: String,
    required: false,
  },
  type: {
    type: String,
    required: true,
  },
  media: {
    type: String,
    required: false,
    default: '',
  },
  timestamp: {
    type: Date,
    default: Date.now,
  },
});
module.exports = mongoose.model("chat", chatSchema);
