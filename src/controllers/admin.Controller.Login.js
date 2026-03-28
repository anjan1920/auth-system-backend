import { User } from "../models/user.models.js";
import { ApiResponse } from "../utils/api-response.js";
import { asyncHandler } from "../utils/async-handler.js";
import { ApiError } from "../utils/api-error.js";
import jwt from "jsonwebtoken";


import { setSession } from '../utils/redis_utils.js' //redis 







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



const adminLogin = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  const user = await User.findOne({ email });

  if (!user) {
    console.log("No user found");
    throw new ApiError(401, "No user found");
  }

  console.log("User found.");

  const isPasswordCorrect = await user.isPasswordCorrect(password);

  if (!isPasswordCorrect) {
    throw new ApiError(401, "Invalid password");
  }

  if (user.role !== "admin") {
    console.log("User is not admin");
    throw new ApiError(403, "Unauthorized access");
  }

  // generate tokens
  console.log("Generating access and refresh tokens..");
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
  };

  const loggedInUser = await User.findById(user._id).select(
    "-password -refreshToken -emailVerificationToken -emailVerificationExpiry"
  );

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
        },
        "Admin logged in successfully"
      )
    );
});

export { adminLogin };