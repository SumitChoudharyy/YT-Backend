import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";

const app = express();

// MiddleWare for 
app.use(cors({
    origin:process.env.CORS_ORIGIN,
    credentials:true
}))

// Middleware for Parsing the data
app.use(express.json({limit:"16kb"}))

// Middleware for data that comes from url(Extended is use to get if object is pass in object)
app.use(express.urlencoded({extended:true,
    limit:"16kb"}))

// to store the file or something and in will store in public folder
app.use(express.static("public"))

// TO parser the cookie parser
app.use(cookieParser());

// Import Routes
import userRouter from './routes/user.routes.js'
import healthcheckRouter from "./routes/healthcheck.routes.js"
import tweetRouter from "./routes/tweet.routes.js"
import subscriptionRouter from "./routes/subscription.routes.js"
import videoRouter from "./routes/video.routes.js"
import commentRouter from "./routes/comment.routes.js"
import likeRouter from "./routes/like.routes.js"
import playlistRouter from "./routes/playlist.routes.js"
import dashboardRouter from "./routes/dashboard.routes.js"


// routes Declaration
app.use("/api/v1/healthcheck", healthcheckRouter)
app.use("/api/v1/users", userRouter)
app.use("/api/v1/tweets", tweetRouter)
app.use("/api/v1/subscriptions", subscriptionRouter)
app.use("/api/v1/videos", videoRouter)
app.use("/api/v1/comments", commentRouter)
app.use("/api/v1/likes", likeRouter)
app.use("/api/v1/playlist", playlistRouter)
app.use("/api/v1/dashboard", dashboardRouter)

export { app };