import { asyncHandler } from "../utils/async-handler.js";
import { User } from "../models/user.models.js";


const getAllUsers = asyncHandler(async (req, res) => {

  const totalUsers = await User.countDocuments();

  //  get users with limited fields
  const users = await User.find({}).select("_id email isEmailVerified");

  // 3send response
  return res.status(200).json({
    success: true,
    totalUsers,
    users
  });

});

export {getAllUsers};