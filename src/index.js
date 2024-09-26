import dotenv from "dotenv";
import connectDB from "./db/connectDb.js";
import { app } from "./app.js";

dotenv.config({
    path:'./.env'
})

const port = process.env.PORT || 4000;

connectDB()
.then(()=> {
    app.listen(port, ()=>{
        console.log(`Server is running at port : ${process.env.PORT}`);
    })
})
.catch((err)=>{
    console.log("MongoDB Connection failed !!!", err);
})