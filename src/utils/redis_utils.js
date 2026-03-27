//set, get, delete session from redis
import redisClient from '../config/redis_connect.js'


// Store session in Redis
export const setSession = async (jti, payload, ttlSeconds) => {
    console.log("Redis - Storing session | jti:", jti, "| ttl:", ttlSeconds, "seconds");

    await redisClient.set(
        `session:${jti}`,        //key
        JSON.stringify(payload), //value ()
        { EX: ttlSeconds }       //TTL in seconds
    );

    console.log(" Redis - Session stored successfully | jti:", jti);


    // Key   :  session:550e8400-xxxx
    // Value  :  JSON string  { userId, email }
    // EX     :  TTL in seconds → auto deletes after expiry 
}

// Get session from Redis
export const getSession = async (jti) => {
    console.log(" Redis - Getting session | jti:", jti);
    
    const data = await redisClient.get(`session:${jti}`);
    
    if (!data) {
        console.log(" Redis - Session not found | jti:", jti);
        return null;
    }
    
    console.log(" Redis - Session found | jti:", jti);
    return JSON.parse(data);


    // ## What's happening here
    // ```
    // Key format :  session:550e8400-xxxx     (session: + jti)
    // Value      :  JSON string of payload    ({ userId, email })
    // Returns    :  parsed object or null

}

// Delete session from Redis (logout)
export const deleteSession = async (jti) => {
    console.log(" Redis - Deleting session | jti:", jti);

    const result = await redisClient.del(`session:${jti}`);

    if (result === 0) {
        console.log(" Redis - Session already expired or not found | jti:", jti);
        return false;
    }

    console.log("Redis - Session deleted successfully | jti:", jti);
    return true;
}
