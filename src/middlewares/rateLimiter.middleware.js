import redisClient from  '../config/redis_connect.js'

export const loginRateLimiter = async (req, res, next) => {
  try {
    //identity the user by email or ip
    const userIdentifier = req.body.email || req.ip;
    //login rate limit
    const key = `rate_limit:login:${userIdentifier}`;

    // increment temp counter
    const attempts = await redisClient.incr(key);//every request = +1

    // set TTL only when first request
    console.log(`User ${req.body.email} attempts : ${attempts}`);
    
    if (attempts === 1) {
      await redisClient.expire(key, 120); //2 min window of attempt count
    }

    //block condition-> if attempt is >5 in 2 min block
    if (attempts > 5) {
        console.log("Too many login attempts.Sending err response");
        
      return res.status(429).json({
        success: false,
        message: "Too many login attempts. Try again later.",
      });
    }

    next();
  } catch (error) {
    console.log("Rate limiter error:", error);
    next(); // fail open
  }
};