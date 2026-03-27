import { Router } from "express";
import { getAllUsers } from "../controllers/getAllUsers.controllers.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import { healthCheck } from "../controllers/healthcheck.controllers.js";
import { verifyRole } from "../middlewares/role.middleware.js";
import { adminLogin } from "../controllers/admin.Controller.Login.js";
const router = Router();




router.route("/healthcheck").get(
  (req, res, next) => {
    console.log("Incoming admin health check request...");
    next(); 
  },
  verifyJWT,
  verifyRole("admin"),
  healthCheck
);



router.route("/getAllUsers").get(
  (req, res, next) => {
    console.log("Incoming admin user count request...");
    next(); 
  },
  verifyJWT,
  verifyRole("admin"),
  getAllUsers
);

router.route("/login").post(
  (req, res, next) => {
    console.log("Incoming admin login request...");
    next(); 
  },
  adminLogin
);



export default router;
