import mongoose,{Schema} from "mongoose";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt"

const userSchema = new Schema(
    {
        username :{
            type:String,
            required:true,
            unique:true,
            lowercase:true,
            trim:true,
            index:true
        },
        email : {
            type:String,
            required:true,
            unique:true,
            lowercase:true,
            trim:true
        },
        fullName : {
            type:String,
            required:true,
            trim:true,
            index:true
        },
        avatar : {
            type:String, // Cloudinary Url
            required:true,
        },
        coverImage : {
            type:String, //Cloudinary Url
        },
        watchHistory : [
            {
                type:Schema.Types.ObjectId,
                ref:"Video"
            }
        ],
        password : {
            type : String,
            required: [true, 'Password is required']
        },
        refreshToken : {
            type:String
        }
    },
    {
        timestamps: true
    }
)

// Middleware That Hash the password when password is change 
userSchema.pre("save", async function (next) {
    
    if(!this.isModified("password")) return next();

    this.password = await bcrypt.hash(this.password,10);
    next()
})

// Method That check password entered by user is correct or not
userSchema.methods.isPasswordCorrect = async function (password){
    return await bcrypt.compare(password, this.password)
}

// Method that Generate Access token when it will call
userSchema.methods.generateAccessToken = function () {
   return jwt.sign(
        {
            _id: this._id,
            email: this.email,
            username: this.username,
            fullName: this.fullName
        },
        process.env.ACCESS_TOKEN_SECRET,
        {
            expiresIn:process.env.ACCESS_TOKEN_EXPIRY
        }
    )
}

// Method that generate Refresh Token When it will call
userSchema.methods.generateRefreshToken = function (){
    return jwt.sign(
        {
            _id: this._id,
        },
        process.env.REFRESH_TOKEN_SECRET,
        {
            expiresIn:process.env.REFRESH_TOKEN_EXPIRY
        }
    )
}

export const User = mongoose.model("User", userSchema);