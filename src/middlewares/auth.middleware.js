import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import jwt from "jsonwebtoken";
import { User } from "../models/user.model.js";
import { ApiError } from "../utils/ApiError.js";

export const verifyJWT = asyncHandler (async (req, _, next) => {
    try {

        //fetching token from cookies or header
        const token = req.cookies?.accessToken || req.header("Authorization")?.replace("Bearer ", "");
    
        // Token is unaviable
        if( !token ){
            throw new ApiResponse(401, "Unauthorized request");
        }
    
        // Using verify function of jwt we verify the access token
        const decodedToken = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
    
        //fetch user from DB
        const user = await User.findById(decodedToken?._id).
        select("-password -refreshToken");
    
        // Check if User Exist or not
        if( !user ) {
            throw new ApiError(401,"Invalid Access Token");
        }
    
        // Add user to req
        req.user = user;
        next();

    } catch (error) {
        throw new ApiError(401, error?.message || "Invalid Access Token");
    }

})