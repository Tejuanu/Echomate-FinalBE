const mongoose = require("mongoose");
const uniqueValidator = require("mongoose-unique-validator");

const userSchema = new mongoose.Schema({
  friends: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "user",
    },
  ],
  displayName: {
    type: String,
    required: true,
  },
  email: {
    type: String,
    required: true,
    unique: true,
  },
  photoURL: {
    type: String,
    required: true,
  },
  cover: {
    type: String,
    required: false,
  },
  socket_id: {
    type: String,
    default: "",
  },
  dob: {
    type: Date,
    required: false,
  },
  address: {
    type: String,
    required: false,
  },
  phoneNumber: {
    type: String,
    required: false,
  },
  accessToken: {
    type: String,
    required: true,
  },
  requests: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "user",
    },
  ],
});
userSchema.plugin(uniqueValidator, {
  message: "Error, expected {PATH} to be unique.",
});
module.exports = mongoose.model("user", userSchema);
