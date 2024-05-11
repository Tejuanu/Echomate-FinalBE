#!/usr/bin/env node
var app = require("./app");
var debug = require("debug")("echo-mate-server:server");
var http = require("http");
const { Server } = require("socket.io");
const mongoose = require("mongoose");
const Chat = require("./models/chat.models");
const Post = require("./models/post.models");
const User = require("./models/user.models");
const _ = require("lodash");
require('dotenv').config();

var port = normalizePort(process.env.PORT || "8000");
const socketPort = 3000
app.set("port", port);
var server = http.createServer(app);
function normalizePort(val) {
  var port = parseInt(val, 10);

  if (isNaN(port)) {
    // named pipe
    return val;
  }

  if (port >= 0) {
    // port number
    return port;
  }

  return false;
}

/**
 * Event listener for HTTP server "error" event.
 */

function onError(error) {
  console.log(error.message)
  // if (error.syscall !== "listen") {
  //   throw error;
  // }

  // var bind = typeof port === "string" ? "Pipe " + port : "Port " + port;

  // // handle specific listen errors with friendly messages
  // switch (error.code) {
  //   case "EACCES":
  //     console.error(bind + " requires elevated privileges");
  //     process.exit(1);
  //     break;
  //   case "EADDRINUSE":
  //     console.error(bind + " is already in use");
  //     process.exit(1);
  //     break;
  //   default:
  //     throw error;
  // }
}

/**
 * Event listener for HTTP server "listening" event.
 */

function onListening() {
  var addr = server.address();
  var bind = typeof addr === "string" ? "pipe " + addr : "port " + addr.port;
  debug("Listening on " + bind);
}

// TITLE: WEBSOCKET CONNECTION
const io = new Server(socketPort, {
  // options
});

io.on("connection", async (socket) => {
  console.log(`user connected: ${socket.id}`);

  //TITLE: disconnect
  socket.on("disconnect", async () => {
    try {
      await User.findOneAndUpdate({ socket_id: socket.id }, { socket_id: "" });
    } catch (error) {
      console.log(error.message);
    }
  });

  //TITLE: get all messages
  socket.on("get-messages-request", async (data) => {
    try {
      const chats = await Chat.find({
        $or: [
          { sender: data.sender, receiver: data.receiver },
          { sender: data.receiver, receiver: data.sender },
        ],
      });
      socket.emit("get-messages-response", chats);
    } catch (error) {
      socket.emit("get-messages-error", error.message);
    }
  });

  //TITLE: get user by id
  socket.on("get-user-by-id-request", async (data) => {
    try {
      const user = await User.findOne({ _id: data });
      socket.emit("get-user-by-id-response", user);
    } catch (error) {
      socket.emit("get-user-by-id-error", error.message);
    }
  });

  //TITLE: get user by email
  socket.on("get-user-by-email-request", async (data) => {
    try {
      const user = await User.findOne({ email: data.email })
        .populate("requests")
        .populate("friends");
      if (user) return socket.emit("get-user-by-email-response", user);
      const newUser = await User.create(data);
      socket.emit("get-user-by-email-response", newUser);
    } catch (error) {
      socket.emit("get-user-by-email-error", error.message);
    }
  });

  //TITLE: send message
  socket.on("send-message-request", async (data) => {
    try {
      const chat = new Chat(data);
      await chat.save();
      io.emit("send-message-response", chat);
    } catch (error) {
      socket.emit("send-message-error", error.message);
    }
  });

  //TITLE: update User
  socket.on("update-user", async (data) => {
    try {
      const email = data.email;
      delete data.email;
      const user = await User.findOneAndUpdate({ email: email }, data, {
        upsert: true,
      });
      socket.emit("update-user-response", user);
    } catch (error) {
      console.log(error);
      socket.emit("update-user-error", error.message);
    }
  });

  //TITLE: search users
  socket.on("search-users-request", async (data) => {
    try {
      const users = await User.find({
        displayName: { $regex: data, $options: "i" },
      }).select("displayName email _id photoURL");
      socket.emit("search-users-response", users);
    } catch (error) {
      socket.emit("search-users-error", error.message);
    }
  });

  //TITLE: get profile
  socket.on("get-profile-request", async (data) => {
    try {
      const user = await User.findOne({ _id: data })
        .populate("requests")
        .populate("friends")
        .exec();
      const posts = await Post.find({ owner: data }).populate("owner").exec();
      socket.emit("get-profile-response", { ...user._doc, posts });
    } catch (error) {
      socket.emit("get-profile-error", error.message);
    }
  });

  //TITLE: update profile
  socket.on("update-profile", async (data) => {
    try {
      console.log(data);
      const user = await User.findOneAndUpdate({ _id: data._id }, data);
      socket.emit("update-profile-response", user);
    } catch (error) {
      socket.emit("update-profile-error", error.message);
    }
  });

  //TITLE: send friend request
  socket.on("send-friend-request", async (data) => {
    try {
      const user = await User.findOne({ _id: data.receiver });
      const requests = user.requests.map((item) => item.toString());
      const uniqRequests = _.uniq([...requests, data.sender]);
      user.requests = uniqRequests.map(
        (item) => new mongoose.Types.ObjectId(item)
      );
      await user.save();
      const newUser = await User.findOne({ _id: data.receiver })
        .populate("friends")
        .populate("requests")
        .exec();
      socket.broadcast.emit("send-friend-request-response", newUser);
    } catch (error) {
      console.log(error.message);
      socket.emit("send-friend-request-error", error.message);
    }
  });

  //TITLE: cancel friend request
  socket.on("cancel-friend-request", async (data) => {
    try {
      const user = await User.findOneAndUpdate(
        { _id: data.receiver },
        { $pull: { requests: data.sender } },
        { new: true }
      );
      const senderUser = await User.findOne({ _id: data.sender })
        .populate("requests")
        .populate("friends")
        .exec();
      const receiverUser = await User.findOne({ _id: data.receiver })
        .populate("requests")
        .populate("friends")
        .exec();
      io.emit("get-profile-response", senderUser);
      io.emit("get-profile-response", receiverUser);
      socket.emit("cancel-friend-request-response", user);
    } catch (error) {
      socket.emit("cancel-friend-request-error", error.message);
    }
  });

  //TITLE: accept friend request
  socket.on("accept-friend-request", async (data) => {
    try {
      console.log(data);
      const user = await User.findOneAndUpdate(
        { _id: data.receiver },
        { $push: { friends: data.sender }, $pull: { requests: data.sender } }
      );
      await User.findOneAndUpdate(
        { _id: data.sender },
        { $push: { friends: data.receiver } }
      );
      const receiverUser = await User.findOne({ _id: data.receiver })
        .populate("requests")
        .populate("friends")
        .exec();
      const senderUser = await User.findOne({ _id: data.sender })
        .populate("requests")
        .populate("friends")
        .exec();
      io.emit("get-profile-response", receiverUser);
      io.emit("get-profile-response", senderUser);
      socket.emit("accept-friend-request-response", data);
    } catch (error) {
      socket.emit("accept-friend-request-error", error.message);
    }
  });

  //TITLE: reject friend request
  socket.on("reject-friend-request", async (data) => {
    try {
      const user = await User.findOneAndUpdate(
        { _id: data.receiver },
        { $pull: { requests: data.sender } }
      );

      const senderUser = await User.findOne({ _id: data.sender })
        .populate("requests")
        .populate("friends")
        .exec();
      io.emit("get-profile-response", senderUser);
      socket.emit("reject-friend-request-response", user);
    } catch (error) {
      console.log(error.message);
      socket.emit("reject-friend-request-error", error.message);
    }
  });

  //TITLE: unfriend user
  socket.on("unfriend-user", async (data) => {
    try {
      const user = await User.findOneAndUpdate(
        { _id: data.receiver },
        { $pull: { friends: data.sender } }
      );
      console.log({
        receiver: data.receiver,
        sender: data.sender,
        user: user.friends
      })
      await User.findOneAndUpdate(
        { _id: data.sender },
        { $pull: { friends: data.receiver } }
      );
      const testUser = await User.find({
        _id: { $in: [data.sender, data.receiver] },
      });
      io.emit("get-profile-response", testUser[0]);
      io.emit("get-profile-response", testUser[1]);
      socket.emit("unfriend-user-response", user);
    } catch (error) {
      socket.emit("unfriend-user-error", error.message);
    }
  });

  //TITLE: get all friends
  socket.on("get-friends-request", async (data) => {
    try {
      const user = await User.findOne({ _id: data }).populate("friends").exec();
      socket.emit("get-friends-response", user);
    } catch (error) {
      socket.emit("get-friends-error", error.message);
    }
  });

  //TITLE: create post
  socket.on("create-post", async (data) => {
    try {
      await Post.create(data);
      const posts = await Post.find()
        .populate("owner")
        .populate("comments.user")
        .exec();
      io.emit("create-post-response", posts);
    } catch (error) {
      socket.emit("create-post-error", error.message);
    }
  });

  //TITLE: get all posts
  socket.on("get-posts-request", async () => {
    try {
      const posts = await Post.find()
        .populate("owner")
        .populate("comments.user")
        .exec();
      socket.emit("get-posts-response", posts);
    } catch (error) {
      socket.emit("get-posts-error", error.message);
    }
  });

  //TITLE: delete post
  socket.on("delete-post", async (data) => {
    try {
      await Post.findOneAndDelete({ _id: data });
      const posts = await Post.find()
        .populate("owner")
        .populate("comments.user")
        .exec();
      io.emit("create-post-response", posts);
    } catch (error) {
      socket.emit("delete-post-error", error.message);
    }
  });

  //TITLE: like post
  socket.on("like-post", async (data) => {
    try {
      const post = await Post.findOne({ _id: data.post_id });
      post.likes = [...post.likes, data.user_id];
      await post.save();
      const posts = await Post.find()
        .populate("owner")
        .populate("comments.user")
        .exec();
      io.emit("create-post-response", posts);
    } catch (error) {
      socket.emit("like-post-error", error.message);
    }
  });

  //TITLE: unlike post
  socket.on("unlike-post", async (data) => {
    try {
      const post = await Post.findOne({ _id: data.post_id });
      post.likes = post.likes.filter(
        (item) => item.toString() !== data.user_id
      );
      await post.save();
      const posts = await Post.find()
        .populate("owner")
        .populate("comments.user")
        .exec();
      io.emit("create-post-response", posts);
    } catch (error) {
      socket.emit("unlike-post-error", error.message);
    }
  });

  //TITLE: comment post
  socket.on("comment-post", async (data) => {
    try {
      const post = await Post.findOne({ _id: data.post_id });
      post.comments = [
        ...post.comments,
        {
          text: data.text,
          user: data.user_id,
        },
      ];
      await post.save();
      const posts = await Post.find()
        .populate("owner")
        .populate("comments.user")
        .exec();
      io.emit("create-post-response", posts);
    } catch (error) {
      socket.emit("comment-post-error", error.message);
    }
  });
});

const uri = process.env.mongodb_uri;
mongoose
  .connect(uri)
  .then(() => {
    console.log("Database connected");
  })
  .catch((error) => {
    console.log(error.message);
  });

server.listen(port, () => {
  console.log("Server is running on port: ", port);
  console.log("socket server is at: ", socketPort)
})
server.on("error", onError);
server.on("listening", onListening);
// //