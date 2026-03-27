import { User } from "../models/user.models.js";
import { ApiError } from "../utils/api-error.js";
import { asyncHandler } from "../utils/async-handler.js";
import jwt from "jsonwebtoken";
import { getSession } from '../utils/redis_utils.js' 



// verify the token 
export const verifyJWT = asyncHandler(async (req, res, next) => {
  console.log("verifyJWT Middleware ------");

  // extract token from cookies or Authorization header
  const token = req.cookies?.accessToken || req.header("Authorization")?.replace("Bearer ", "");

  if (!token) {
    console.log(" No token found in request");
    throw new ApiError(401, "Unauthorized request");
  }
  console.log("Token extracted successfully");

  try {
    // verify JWT signature + expiry
    console.log(" Verifying JWT signature...");
    const decodedToken = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
    console.log("JWT signature valid ");

    // check Redis if session is still alive
    console.log(" Checking session in Redis | jti:", decodedToken.jti);
    const isValid = await getSession(decodedToken.jti);

    if (!isValid) {
      console.log(" Session not found in Redis - logged out or expired | jti:", decodedToken.jti);
      throw new ApiError(401, "Session expired or logged out");
    }
    console.log("Session found in Redis - token is alive");

    // find user in DB
    console.log(" Finding user in DB | user_id:", decodedToken._id);

    const user = await User.findById(decodedToken._id).select(
      "-password -refreshToken -emailVerificationToken -emailVerificationExpiry"
    );

    if (!user) {
      console.log(" No user found in DB for this token | user_id:", decodedToken._id);
      throw new ApiError(401, "Invalid access token");
    }
    console.log(" User found in DB | email:", user.email);

    // attach user to request and proceed
    req.user = user
    console.log(" verifyJWT passed | proceeding to next middleware");
    next();

  } catch (error) {
    
    if (error instanceof ApiError) throw error 
    console.log(" JWT verification failed:", error.message)
    throw new ApiError(401, "Invalid access token");
  }
});