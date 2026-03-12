import { User } from "../models/user.models.js";
import { ApiResponse } from "../utils/api-response.js";
import { ApiError} from "../utils/api-error.js";
import { asyncHandler } from "../utils/async-handler.js";
import {
   emailVerificationMailgenContent,
   forgotPasswordMailgenContent,
  sendEmail,
} from "../utils/mail.js";

import jwt from "jsonwebtoken";
import crypto from 'crypto';









const registerUser = asyncHandler(async (req, res) => {

  const { email, username, password, role } = req.body;

  const existedUser = await User.findOne({
    $or: [{ username }, { email }],
  });

  if (existedUser) {
    throw new ApiError(409, "User with email or username already exists", []);
  }
  //create new user 
  const user = await User.create({
    email,
    password,
    username,
    isEmailVerified: false,
  });
  //generate email verification from User.model.js method
  const { unHashedToken, hashedToken, tokenExpiry } = user.generateTemporaryToken();

  user.emailVerificationToken = hashedToken;//un-hashed email verification token send to user email
  user.emailVerificationExpiry = tokenExpiry;

  await user.save({ validateBeforeSave: false });
  //send the email  using nodemailer
  try {
    await sendEmail({
      email: user?.email,
      subject: "Please verify your email",
      mailgenContent: emailVerificationMailgenContent(
        user.username,
        `http://127.0.0.1:5500/frontend/pages/email-verify.html?token=${unHashedToken}`
      ),
    });
  } catch (error) {
    console.error("Email sending failed:", error);
    throw new ApiError(500, "Something went wrong while sending email.");
  }


  //fetch the created user details
  const createdUser = await User.findById(user._id).select("-password -refreshToken -emailVerificationToken -emailVerificationExpiry",);

  if (!createdUser) {
    throw new ApiError(500, "Something went wrong while registering a user");
  }
  //send the response 
  return res
    .status(201)
    .json(
      new ApiResponse(
        200,
        { userid: createdUser._id   },
        "User registered successfully and verification email has been sent on your email",
      ),
    );
});





const verifyEmail = asyncHandler(async (req, res) => {
  //extract the verification token
  console.log("Verifying email...");
  
  const { verificationToken } = req.params;

  if (!verificationToken) {
    throw new ApiError(400, "Email verification token is missing");
  }

  let hashedToken = crypto
    .createHash("sha256")
    .update(verificationToken)
    .digest("hex");
  //find the user with this email verification token
  const user = await User.findOne({
    emailVerificationToken: hashedToken,
    emailVerificationExpiry: { $gt: Date.now() },
  });

  if (!user) {
    throw new ApiError(400, "Token is invalid or expired");
  }

  user.emailVerificationToken = undefined;
  user.emailVerificationExpiry = undefined;

  user.isEmailVerified = true;
  await user.save({ validateBeforeSave: false });
  console.log("Email verification successful.");
  
  return res.status(200).json(
    new ApiResponse(
      200,
      {
        isEmailVerified: true,
      },
      "Email is verified.Now you can login with your id and password",
    ),
  );
});



const login = asyncHandler(async (req, res) => {
  const { email, password, username } = req.body;

  if (!email) {
    throw new ApiError(400, " email is required");
  }
  //find user using the email
  console.log("Finding user...");
  
  const user = await User.findOne({ email });

  if (!user) {
    console.log("User not found .");
    
    throw new ApiError(400, "User does not exists");
  }
  console.log("User founded.");
  console.log("Verifying password..");
  
  

  const isPasswordValid = await user.isPasswordCorrect(password);//use user.model method

  if (!isPasswordValid) {
    console.log("Wrong password.");
    
    throw new ApiError(400, "Invalid credentials");
  }

  if (user.role === "admin") {
    console.log("User is admin..cant login here");
    throw new ApiError(403, "Admin users use different option");
  }
  //generate the access and refresh tokens for the user
  console.log("Generating access and Refresh tokens..");
  
  const { accessToken, refreshToken } = await generateAccessAndRefreshTokens(user._id,)
  
  //get the user 
  const loggedInUser = await User.findById(user._id).select(
    "-password -refreshToken -emailVerificationToken -emailVerificationExpiry",
  );
  //CONSTRAIN for the client to store token
  const options = {
    httpOnly: true,
    secure: true,
    sameSite: "None",
  };


  return res
    .status(200)
    .cookie("accessToken", accessToken, options)
    .cookie("refreshToken", refreshToken, options)
    .json(

      new ApiResponse(
        200,
        {
          user: loggedInUser,
          //we sending this token in json just for testing part
          //ideally its should not send in json , cause browser js get access of the token
          // accessToken,
          // refreshToken,
        },
        "User logged in successfully",
      ),
    );
});






const generateAccessAndRefreshTokens = async (userId) => {
  try {
    //generate the access and refresh token for user
    const user = await User.findById(userId);

    const accessToken = user.generateAccessToken();
    const refreshToken = user.generateRefreshToken();

    //save the refresh token in db
    user.refreshToken = refreshToken;
    await user.save({ validateBeforeSave: false });
    //return  new  access token and refresh token
    return { accessToken, refreshToken };

  } catch (error) {
    throw new ApiError(
      500,
      "Something went wrong while generating access token",
    );
  }
};






const refreshAccessToken = asyncHandler(async (req, res) => {
  const incomingRefreshToken =  req.cookies.refreshToken || req.body.refreshToken;

  if (!incomingRefreshToken) {
    console.log("No token present in request..");
    
    throw new ApiError(401, "Unauthorized access");
  }

  //verify the refresh token
  try {
    const decodedToken = jwt.verify(incomingRefreshToken,process.env.REFRESH_TOKEN_SECRET,);
    console.log("Verified refresh token.");
    
    //find user id which is in refresh token
    const user = await User.findById(decodedToken?._id);
    if (!user) {
      console.log("User not found.");
      throw new ApiError(401, "Invalid refresh token");
    }

    if (incomingRefreshToken !== user?.refreshToken) {
      console.log("Refresh token expired.");
      
      throw new ApiError(401, "Refresh token in expired");
    }
    console.log("valid refreshtToken");
    
    //CONSTRAIN for the client to store token
    const options = {
      httpOnly: true,
      secure: true,
      sameSite: "None",
    };

    //generate new access ,refresh token,
    console.log("Generating new access & refresh Token");
    
    const { accessToken, refreshToken } = await generateAccessAndRefreshTokens(user._id);

    user.refreshToken = refreshToken;
    await user.save({ validateBeforeSave: false });
    
    //send the new tokens to user
    console.log("Sending new access and refreshToken to user");
    
   return res
    .status(200)
    .cookie("accessToken", accessToken, options)
    .cookie("refreshToken", refreshToken, options)
    .json(
      new ApiResponse(
        200,
        {},   // no need to send tokens in JSON
        "Access token refreshed"
      )
    );
  } catch (error) {
    throw new ApiError(401, "Invalid refresh token");
  }
});




const logoutUser = asyncHandler(async (req, res) => {
  //find the user based on the id
  await User.findByIdAndUpdate(
    req.user._id,
    {
      $set: {
        refreshToken: "",
      },
    },
    {
      new: true,
    },
  );
  const options = {
    httpOnly: true,
    secure: true,
    sameSite: "None",
    path: "/"
  };
  console.log("User logged out successfully");
  
  return res
    .status(200)
    .clearCookie("accessToken", options)
    .clearCookie("refreshToken", options)
    .json(new ApiResponse(200, {}, "User logged out"));
});


const forgotPasswordRequest = asyncHandler( async (req, res) => {
  const { email } = req.body;
  console.log(`Email : ${email}`);
  
  
  console.log(`Finding user using emil : ${email}`);
  
  const user = await User.findOne({ email });
  console.log("User found.");
  

  if (!user) {
    console.log("User not found ..!!");
    
    throw new ApiError(404, "User does not exists", []);
  }
  
  //generate forgot password tokens
  const { unHashedToken, hashedToken, tokenExpiry } = user.generateTemporaryToken();

  user.forgotPasswordToken = hashedToken;//assign hashed token to user
  user.forgotPasswordExpiry = tokenExpiry;

  await user.save({ validateBeforeSave: false });//save the token in DB

  //send the unhashed token to user email
  try {
    await sendEmail({
      email: user?.email,
      subject: "Password reset request",
      mailgenContent: forgotPasswordMailgenContent(
        user.username,
        `http://127.0.0.1:5500/frontend/pages/reset-password.html?token=${unHashedToken}`
      ),
    });
  } catch (error) {
    console.error("Email sending failed:", error);
    throw new ApiError(500, "Something went wrong while sending email");
  }
    

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        {},
        `Password reset mail has been sent on your mail id `,
      ),
    );
});



 const resetForgotPassword = asyncHandler(async (req, res) => {
  const { resetToken } = req.params;
  const { newPassword } = req.body;
  //hash the token with same salt while creating 
  let hashedToken = crypto
    .createHash("sha256")
    .update(resetToken)
    .digest("hex");
  //find user based on forget password token
  const user = await User.findOne({forgotPasswordToken: hashedToken,
    forgotPasswordExpiry: { $gt: Date.now() },//this check expiry 
  });

  if (!user) {
    throw new ApiError(489, "Token is invalid or expired");
  }
  //if user found
  //reset the forgot password token and expiry
  user.forgotPasswordExpiry = undefined;
  user.forgotPasswordToken = undefined;

  user.password = newPassword;//assign the new password
  await user.save({ validateBeforeSave: false });///save in DB


  return res
    .status(200)
    .json(
      new ApiResponse(200, {}, "Password reset successfully now try to login"

    ));
});



const getCurrentUser = asyncHandler(async (req, res) => {

  return res
    .status(200)
    .json(new ApiResponse(200, req.user, "Current user fetched successfully"));
});




const changeCurrentPassword = asyncHandler(async (req, res) => {
  const { oldPassword, newPassword } = req.body;

  const user = await User.findById(req.user?._id);

  const isPasswordValid = await user.isPasswordCorrect(oldPassword);

  if (!isPasswordValid) {
    throw new ApiError(401, "Invalid old Password");
  }

  user.password = newPassword;
  await user.save({ validateBeforeSave: false });

  return res
    .status(200)
    .json(new ApiResponse(200, {}, "Password changed successfully"));
});




const deleteCurrentUser = asyncHandler(async(req,res)=>{
  const user_id = req.user?._id;
  const password = req.body.password;

  //find user based on that id
  const user = await User.findById(user_id)
  if(!user){
    //no user present with that id
    throw new ApiError(401, "Invalid user");
  }
  //user found now match password
  const isPasswordCorrect = await user.isPasswordCorrect(password);
  if(!isPasswordCorrect){
     throw new ApiError(401, "Invalid password ");

  }
  //now delete the user document
  await User.findByIdAndDelete(user_id);
  //clear the cookies 
  res.clearCookie("refreshToken");

  return res.status(200).json({
    success: true,
    message: "Account deleted successfully"
  });

});



const resendEmailVerification = asyncHandler(async (req, res) => {

  // 1 get email from request body
  const { email } = req.body;

  if (!email) {
    throw new ApiError(400, "Email is required");
  }

  // find user by email
  console.log("Finding user ..");
  
  const user = await User.findOne({ email });

  if (!user) {
    console.log("No user found with email :",email);
    
    throw new ApiError(404, "User not found with this email");
  }
  console.log("User founded");
  
  // check if email already verified
  if (user.isEmailVerified) {
    console.log("Email is already verified..");
    
    throw new ApiError(400, "Email is already verified");
  }

  //generate verification token
  console.log("Generating token");
  
  const { unHashedToken, hashedToken, tokenExpiry } = user.generateTemporaryToken();

  //store token in database
  user.emailVerificationToken = hashedToken;
  user.emailVerificationExpiry = tokenExpiry;
  console.log("Saving user..");
  await user.save({ validateBeforeSave: false });

  //send verification email
  console.log("Sending email..");
  
  await sendEmail({
    email: user.email,
    subject: "Verify your email",
    mailgenContent: emailVerificationMailgenContent(
      user.username,
      `http://127.0.0.1:5500/frontend/pages/email-verify.html?token=${unHashedToken}`
    ),
  });

  //send response
  return res.status(200).json(
    new ApiResponse(
      200,
      {},
      "Verification email resent successfully"
    )
  );

});

export {
  registerUser,
  verifyEmail,
  login,
  refreshAccessToken,
  logoutUser,
  forgotPasswordRequest,
  resetForgotPassword,
  getCurrentUser,
  changeCurrentPassword,
  deleteCurrentUser,
  resendEmailVerification

 
};



