import { User } from "../models/user.models.js";
import { ApiResponse } from "../utils/api-response.js";
import { ApiError } from "../utils/api-error.js";
import { asyncHandler } from "../utils/async-handler.js";
import {
  emailVerificationMailgenContent,
  forgotPasswordMailgenContent,
  sendEmail,
} from "../utils/mail.js";

import jwt from "jsonwebtoken";
import crypto from 'crypto';

import { setSession } from '../utils/redis_utils.js' //redis 
import { deleteSession } from '../utils/redis_utils.js' //redis 







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
        `http://127.0.0.1:5500/pages/email-verify.html?token=${unHashedToken}`
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
        { userid: createdUser._id },
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
  
  const { email, password } = req.body;
  if (!email || !password) {
    throw new ApiError(400, "Email and password are required");
  }

  //find user
  const user = await User.findOne({ email });

  if (!user) {
    throw new ApiError(400, "User does not exist");
  }

  // check password is correct 
  const isPasswordValid = await user.isPasswordCorrect(password);

  if (!isPasswordValid) {
    throw new ApiError(401, "Invalid credentials");
  }

  // restrict admin login
  if (user.role === "admin") {
    throw new ApiError(403, "Admins must use a different login route");
  }
 
  // check email verification status
  if (!user.isEmailVerified) {
    console.log("Email is not verified.");
    
    try {
      const { unHashedToken, hashedToken, tokenExpiry } = user.generateTemporaryToken();

      user.emailVerificationToken = hashedToken;
      user.emailVerificationExpiry = tokenExpiry;
      

      await user.save({ validateBeforeSave: false });
      console.log("Sending email verification email..");
      
      await sendEmail({
        email: user.email,
        subject: "Please verify your email",
        mailgenContent: emailVerificationMailgenContent(
          user.username,
          `http://127.0.0.1:5500/pages/email-verify.html?token=${unHashedToken}`
          
        ),
      });

    }
    catch (error) {
      console.error("Email sending failed:", error.message);
      
    }

    // STOP LOGIN HERE
    throw new ApiError(
      403,
      "Please verify your email. A verification link has been sent."
    );
  }

  // else email is verified -> Generate tokens
  const { accessToken, refreshToken } = await generateAccessAndRefreshTokens(user._id);

  // decode the access token to get jti
  const decodedAccessToken = jwt.verify(accessToken, process.env.ACCESS_TOKEN_SECRET);

  // set the redis session
  const accessTokenJti = decodedAccessToken.jti;
  const payload = { userId: user._id, email: user.email };
  const ttlSecond = 15 * 60; // 15 mins

  try {
      await setSession(accessTokenJti, payload, ttlSecond);
  } catch {
      throw new ApiError(500, "Redis Session creation failed, please try again");
  }

      

  // Get safe user data
  const loggedInUser = await User.findById(user._id).select(
    "-password -refreshToken -emailVerificationToken -emailVerificationExpiry"
  );

  // Cookie options
  const options = {
    httpOnly: true,
    secure: true,
    sameSite: "None",
  };

  //send response
  return res
    .status(200)
    .cookie("accessToken", accessToken, options)
    .cookie("refreshToken", refreshToken, options)
    .json(
      new ApiResponse(
        200,
        { user: loggedInUser },
        "User logged in successfully"
      )
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
  const incomingRefreshToken = req.cookies.refreshToken || req.body.refreshToken;

  if (!incomingRefreshToken) {
    console.log("No token present in request..");

    throw new ApiError(401, "Unauthorized access");
  }

  //verify the refresh token
  try {
    const decodedToken = jwt.verify(incomingRefreshToken, process.env.REFRESH_TOKEN_SECRET,);
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
    //start redis session
    // decode the access token to get jti
    const decodedAccessToken = jwt.verify(accessToken, process.env.ACCESS_TOKEN_SECRET);

    // set the redis session
    const accessTokenJti = decodedAccessToken.jti;
    const payload = { userId: user._id, email: user.email };
    const ttlSecond = 15 * 60; // 15 mins

    try {
        await setSession(accessTokenJti, payload, ttlSecond);
    } catch {
        throw new ApiError(500, "Redis Session creation failed, please try again");
    }
    
    //save refresh-token in db
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
  //clear refresh token from DB
  await User.findByIdAndUpdate(
    req.user._id,
    { $set: { refreshToken: "" } },
    { new: true }
  );

  // get token from cookies or header (already verified by middleware)
  const token = req.cookies?.accessToken || req.header("Authorization")?.replace("Bearer ", "");
  
  // decode to get jti - no need to verify again, middleware already did it
  const decodedAccessToken = jwt.decode(token);  // jwt.decode not jwt.verify ← just decode
  
  try {
    await deleteSession(decodedAccessToken.jti);
  } catch {
    throw new ApiError(500, "Session deletion failed");
  }

  const options = {
    httpOnly: true,
    secure: true,
    sameSite: "None",
    path: "/"
  };

  return res
    .status(200)
    .clearCookie("accessToken", options)
    .clearCookie("refreshToken", options)
    .json(new ApiResponse(200, {}, "User logged out"));
});



const forgotPasswordRequest = asyncHandler(async (req, res) => {
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
  const user = await User.findOne({
    forgotPasswordToken: hashedToken,
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




const deleteCurrentUser = asyncHandler(async (req, res) => {
  const user_id = req.user?._id;
  const password = req.body.password;

  //find user based on that id
  const user = await User.findById(user_id)
  if (!user) {
    //no user present with that id
    throw new ApiError(401, "Invalid user");
  }
  //user found now match password
  const isPasswordCorrect = await user.isPasswordCorrect(password);
  if (!isPasswordCorrect) {
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
    console.log("No user found with email :", email);

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



