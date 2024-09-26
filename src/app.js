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


// routes Declaration
app.use("/api/v1/users", userRouter);


export { app };