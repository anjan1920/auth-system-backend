import { ApiError } from "../utils/api-error.js";

//decline access to routes like delete,password-change, reset, forgot for specific IDs
//it's only for test user and test admin ids

//Get env string
const idsString = process.env.PROTECTED_USER_IDS || "";
// split into array of string ids
const idsArray = idsString.split(",");
// trim each value (create new array)
const protectedIds = idsArray.map(id => id.trim());


export const blockProtectedUser = (req, res, next) => {
  //current user id
  const userId = req.user?._id?.toString();

 
  if (protectedIds.includes(userId)) {
    return next(new ApiError(403, "This account is protected"));
  }

  
  next();
};
