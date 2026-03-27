import { Router } from "express";
// middlewares
import { verifyJWT } from "../middlewares/auth.middleware.js";
import { validate } from "../middlewares/validator.middleware.js";

// controllers
import {
  registerUser,
  verifyEmail,
  login,
  refreshAccessToken,
  logoutUser,
  forgotPasswordRequest,
  resetForgotPassword,
  changeCurrentPassword,
  getCurrentUser,
  deleteCurrentUser,
  resendEmailVerification
} from "../controllers/auth.controllers.js";
// validators
import {
  userForgotPasswordValidator,
  userLoginValidator,
  userRegisterValidator,
  userResetForgotPasswordValidator,
  userChangeCurrentPasswordValidator
} from "../validators/index.js";

import { loginRateLimiter } from  "../middlewares/rateLimiter.middleware.js"


const router = Router();


router.route("/register").post(
  (req, res, next) => {
    console.log("Incoming registration request...");
    next(); // Move to userRegisterValidator
  },
  userRegisterValidator(),//collect the request err 
  validate, //handle the errors
  registerUser//main logic
);


router.route("/verify-email/:verificationToken").get(
  (req,res,next)=>{
    console.log("Incoming email verification  request...");
    next(); 

  },
  verifyEmail
);


router.route("/login").post(
  (req, res, next) => {
    console.log("Incoming login request...");
    next();
  },
  userLoginValidator(), // collect validation errors
  validate,             // send error response if invalid
  loginRateLimiter,    
  login                 // controller
);


router.route("/refresh-token").post(
  (req,res,next)=>{
    console.log("Incoming refresh-token request...");
    next();
    
  },
  refreshAccessToken,
);

router.route("/logout").post(
  (req,res,next)=>{
    console.log("Incoming logout request...");
    next();

  },
  verifyJWT,
  logoutUser,
);

router.route("/forgot-password").post(
  (req,res,next)=>{
    console.log("Incoming forgot password  request...");
    next();
    
  },
  userForgotPasswordValidator(),//collect input err
  validate,//handle err if any
  forgotPasswordRequest //logic
);

router.route("/reset-password/:resetToken").post(
  (req,res,next)=>{
    console.log("Incoming  password  reset request...")
    next();
    
  },
  userResetForgotPasswordValidator(), ////just collect the err in new password input
  validate,//handle errs if any
  resetForgotPassword//logic

);

 router.route("/change-password").post(
  (req,res,next)=>{
    console.log("Incoming change password request....");
    next();
  },
    verifyJWT,//verify access token
    userChangeCurrentPasswordValidator(),//collect input err
    validate,//handle input err if any
    changeCurrentPassword,
  );




router.route("/current-user").get(
  (req,res,next)=>{
    console.log("Incoming get current user request..");
    next();
    
  },
  verifyJWT, //verify the incoming access jwt token
  getCurrentUser//logic
);



router.route("/delete-me").delete(
  (req,res,next)=>{
  console.log("Incoming delete account request..");
  next();
},
verifyJWT,
deleteCurrentUser
);


router.route("/resend-verification").post(
  (req,res,next)=>{
    console.log("Incoming resend email verification link request..");
    next();
    
  },
  resendEmailVerification
);




export default router;




// router
//   .route("/forgot-password")
//   .post(userForgotPasswordValidator(), validate, forgotPasswordRequest);
// router
//   .route("/reset-password/:resetToken")
//   .post(userResetForgotPasswordValidator(), validate, resetForgotPassword);

// //secure routes

// router.route("/current-user").post(verifyJWT, getCurrentUser);
// router
//   .route("/change-password")
//   .post(
//     verifyJWT,
//     userChangeCurrentPasswordValidator(),
//     validate,
//     changeCurrentPassword,
//   );
// router
//   .route("/resend-email-verification")
//   .post(verifyJWT, resendEmailVerification);

