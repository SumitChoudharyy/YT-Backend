import { asyncHandler } from "../utils/asyncHandler.js";
import {ApiError} from "../utils/ApiError.js";
import {User} from "../models/user.model.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";

// Method that generate Access and Refresh Token Together (We made is method because we need it very offenly)
const generateAccessAndRefreshTokens = async (userId) => {
    try {
        const user = await User.findById(userId);
        const accessToken = user.generateAccessToken();
        const refreshToken= user.generateRefreshToken();

        // Save refresh token is Database
        user.refreshToken = refreshToken;
        await user.save({validateBeforeSave: false });//validateBeforeSave will allow us to manage if we want to validate or not before saving

        return {accessToken, refreshToken};

    } catch (error) {
        throw new ApiError(500, "Something went wrong while generating refresh and access token");
    }
}

// Register user handler
const registerUser = asyncHandler( async (req, res) => {
     //get user data from body
    //  validation -> field not empty
    //check if user already exist -> username, mail
    // check for images , check for avatar
    //upload them on cloudinary, avatar
    // Create user object -> create entry in db
    // remove password and refresh token field from response
    // check for user creation
    // return response

    // Fetching data from body
    const {fullName, email, username, password} = req.body;

    // Validation
    // if(fullName === ""){
    //     throw new ApiError(400,"FullName is required");
    // }
    if(
        [fullName, email, username, password].some((field) =>
        field?.trim() === "")
    ){
        throw new ApiError(400,"All field are required")
    }

    // Check If User ALready Exist or Not
    const existedUser = await User.findOne({
        $or: [{ username },{ email }]
    })

    if(existedUser) {
        throw new ApiError(409, "User with email or username already exist");
    }

    // Getting the path Where multer save avatar and CoverImage {local storage path}
    const avatarLocalPath = req.files?.avatar[0]?.path;
   // const coverImageLocalPath =  req.files?.coverImage[0]?.path;

    let coverImageLocalPath ;
    if(req.files && Array.isArray(req.files.coverImage) && req.files.coverImage.length > 0){
        coverImageLocalPath = req.files.coverImage[0].path
    }

    if(!avatarLocalPath){
        throw new ApiError(400, "Avatar file required");
    }

    // Upload image on cloudinary
    const avatar = await uploadOnCloudinary(avatarLocalPath);
    const coverImage = await uploadOnCloudinary(coverImageLocalPath);

    if (!avatar) {
        throw new ApiError(400,"Avatar file requires");
    }

    // Create Entry of User in Database
    const user = await User.create({
        fullName,
        avatar: avatar.url,
        coverImage: coverImage?.url || "",
        email,
        password,
        username: username.toLowerCase()
    })

    // Checking User entry is created Database or not And Deselecting the password and refresh Token
    const createdUser = await User.findById(user._id).select(
        "-password -refreshToken"
    )

    if ( !createdUser ) {
        throw new ApiError(500, "Something Went wrong while registering the user");
    }

    return res.status(201).json(
        new ApiResponse(200, createdUser, "User Register Successfully")
    )

})

// Login user handler
const loginUser = asyncHandler(async (req, res) => {
    // fetch data from req->body
    // Username or mail (Check of user exist or not)
    // find user
    //password check
    // access and refresh token
    // send cookies

    const {email, username, password} = req.body;

    // check we have username or mail id or not
    if ( !username && !email) {
        throw new ApiError(400, "username or email is required");
    }

    // Check user is exist or not
    const user = await User.findOne({
        $or: [{username}, {email}]
    })

    // If user not exist
    if( !user ) {
        throw new ApiError(404,"User does not exist");
    }

    // Check password if user exist
    const isPasswordValid = await user.isPasswordCorrect(password);

    // If password is incorrect
    if( !isPasswordValid ) {
        throw new ApiError(401, "Invalid User credentials")
    }

    // generate Refresh and access token
    const {accessToken, refreshToken} = await generateAccessAndRefreshTokens(user._id);

    // get Updated user and as in previous user we fetch we does not have updated refresh token
    const loggedInUser = await User.findById(user._id).
    select("-password -refreshToken");

    // we make a object , we make it to make cookies unchangable from frontend and only server can change it
    const options = {
        httpOnly: true,
        secure: true
    }

    // return accessToken and refreshToken in cookies
    return res.status(200)
    .cookie("accessToken", accessToken, options)
    .cookie("refreshToken", refreshToken, options)
    .json(
        new ApiResponse(
            200,
            {
                user:loggedInUser,accessToken,refreshToken
            },
            "User logged in Successfully "
        )
    )

})

//Logout Handler
const logoutUser = asyncHandler ( async(req,res) => {
    // we can access user by req.user as our middleware verifyJwt insert user in request
    await User.findByIdAndUpdate(
        req.user._id,
        {
            $unset: {
                refreshToken: 1 // this removes the field from document
            }
        },
        {
            new: true
        }
    )

    //option object will going to pass in cookies
    const options = {
        httpOnly: true,
        secure: true
    }

    // return response that user access and refresh Token
    return res
    .status(200)
    .clearCookie("accessToken", options)
    .clearCookie("refreshToken", options)
    .json(new ApiResponse(200, {}, "User logged Out Successfully"))
})


// Controller for Refresh Access Token
const refreshAccessToken = asyncHandler( async (req, res) => {
    const incomingRefreshToken = req.cookies.refreshToken || req.body.refreshToken;

    if( !incomingRefreshToken) {
        throw new ApiError(401, "Unauthorized request");
    }

    try {
        const decodedToken = jwt.verify(
            incomingRefreshToken,
            process.env.REFRESH_TOKEN_SECRET
        )

        const user = await User.findById(decodedToken?._id);

        if( !user ) {
            throw new ApiError(401, "Invalid refresh Token");
        }

        if(incomingRefreshToken !== user?.refreshToken) {
            throw new ApiError(401, "Refresh token is expired or used");
        }

        const options = {
            httpOnly:true,
            secure:true
        }

        const {accessToken,newRefreshToken} = await generateAccessAndRefreshTokens(user._id);

        return res.status(200)
        .cookie("accessToken", accessToken, options)
        .cookie("refreshToken", newRefreshToken, options)
        .json(
            new ApiResponse(
                200,
                {accessToken, refreshToken: newRefreshToken},
                "Access Token refreshed"
            )
        )
    } catch (error) {
        throw new ApiError(401, error?.message || "Invalid refresh token");
    }
})


// Change Password Handler
const changeCurrentPassword = asyncHandler( async(req,res) => {

    const {oldPassword, newPassword} = req.body;

    const user = await User.findById(req.user?._id);

    const isPasswordCorr = await user.isPasswordCorrect(oldPassword);

    if( !isPasswordCorr ) {
        throw new ApiError(400, "Invalid old password");
    }

    user.password = newPassword;
    await user.save({validateBeforeSave:false})

    return res.status(200)
    .json(new ApiResponse(200, {}, "Password Changed Successfully"))

})


// Handler to Get user (we use jwt Verify middleware which gives user in req)
const getCurrentUser = asyncHandler( async(req,res) => {
    return res.status(200)
    .json(
        new ApiResponse(200, req.user, "Current user is fetched Successfully")
    )
})

// Handler To updated User Details
const updateAccountDetails = asyncHandler(async (req,res) => {
    const {fullName, email} = req.body;

    if(!fullName || !email){
        throw new ApiError(400, "All field are required");
    }

    const user = User.findByIdAndUpdate(
        req.user?._id,
        {
            $set: {
                fullName: fullName,
                email: email
            }
        },
        {new : true}
    ).select("-password -refreshToken")

    return res.status(200)
    .json(new ApiResponse(200, user, "Account Details Updated Successfully"))
})

// Handler to update the User Avatar
const updateUserAvatar = asyncHandler(async (req,res) => {

    const avatarLocalPath = req.file?.path;

    if ( !avatarLocalPath ) {
        throw new ApiError(400, "Avatar file is missing");
    }

    const avatar = await uploadOnCloudinary(avatarLocalPath);

    if (!avatar.url) {
        throw new ApiError(400, "Error while uploading avatar");
    }

    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set:{
                avatar: avatar.url
            }
        },
        {new: true}
    ).select("-password -refreshToken")

    return res.status(200)
    .json(
        new ApiResponse(200, user, "Avatar Successfully Changed")
    )
})

// Handler to update the User Cover Image
const updateUserCoverImage = asyncHandler(async (req,res) => {
    const coverImagePath = req.file?.path;

    if ( !coverImagePath ) {
        throw new ApiError(400, "Cover Image file is missing");
    }

    const coverImage = await uploadOnCloudinary(coverImagePath);

    if (!coverImage.url) {
        throw new ApiError(400, "Error while uploading Cover Image");
    }

    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set:{
                coverImage: coverImage.url
            }
        },
        {new: true}
    ).select("-password -refreshToken")

    return res.status(200)
    .json(
        new ApiResponse(200, user, "Cover Image Successfully Changed")
    )
})


// Handler To get User Channel Profile
const getUserChannelProfile = asyncHandler( async (req,res) => {
    // we get username from params
    const {username} = req.params;

    if ( !username?.trim()) {
        throw new ApiError(400, "Username is missing");
    }

    const channel = await User.aggregate([
        {
            $match: {
                username: username?.toLowerCase()
            }
        },
        {
            $lookup: {
                from: "subscriptions",
                localField:"_id",
                foreignField: "channel",
                as: "subscribers"
            }
        },
        {
            $lookup: {
                from: "subscriptions",
                localField:"_id",
                foreignField: "subscriber",
                as: "subscribedTo"
            }
        },
        {
            $addFields: {
                subscriberCount:{
                    $size: "$subscribers"
                },
                channelSubscribedToCount: {
                    $size: "$subscribedTo"
                },
                isSubscribed : {
                    $cond: {
                        if: {$in: [req.user?._id, "$subscribers.subscriber"]},
                        then: true,
                        else: false
                    }
                }
            }
        },
        {
            $project: {
                fullName: 1,
                username: 1,
                subscriberCount: 1,
                channelSubscribedToCount: 1,
                isSubscribed: 1,
                avatar: 1,
                coverImage: 1,
                email: 1
            }
        }
    ]);

    if( !channel?.length) {
        throw new ApiError(404, "Channel Does not Exist");
    }

    return res.status(200)
    .json(
        new ApiResponse(200, channel[0], "User Data Fetched Successfully")
    )

})

// Handler to get user watch History
const getWatchHistory = asyncHandler ( async (req, res) => {

    const user = await User.aggregate([
        {
            $match: {
                _id: new mongoose.Types.ObjectId(req.user._id)
            }
        },
        {
            $lookup: {
                from:"videos",
                localField: "watchHistory",
                foreignField: "_id",
                as: "watchHistory",
                pipeline: [
                    {
                        $lookup:{
                            from: "users",
                            localField: "owner",
                            foreignField:"_id",
                            as: "owner",
                            pipeline:[
                                {
                                    $project: {
                                        fullName: 1,
                                        username:1,
                                        avatar:1
                                    }
                                }
                            ]
                        }
                    },
                    {
                        $addFields: {
                            owner: {
                                $first: "$owner"
                            }
                        }
                    }
                ]
            }
        }
    ])

    return res.status(200)
    .json(
        new ApiResponse(
            200,
            user[0].watchHistory,
            "Watch history fetched successfully"
        )
    )
})


export {
    registerUser,
    loginUser,
    logoutUser,
    refreshAccessToken,
    changeCurrentPassword,
    getCurrentUser,
    updateAccountDetails,
    updateUserAvatar,
    updateUserCoverImage,
    getUserChannelProfile,
    getWatchHistory
}
