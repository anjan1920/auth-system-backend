import { ApiError } from "../utils/api-error.js";

export const verifyRole = (...allowedRoles) => {
  return (req, res, next) => {
    
    if (!req.user) {
      throw new ApiError(401, "Unauthorized request");
    }

    // Check if user's role is allowed
    if (!allowedRoles.includes(req.user.role)) {
      throw new ApiError(403, "Forbidden: You don't have permission");
    }

    next();
  };
};
