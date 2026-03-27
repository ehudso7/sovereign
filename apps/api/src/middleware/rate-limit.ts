import type { Request, Response, NextFunction } from "express";
import { RateLimiterRedis } from "rate-limiter-flexible";
import { getRedisClient } from "../services/redis.js";

// Different rate limit tiers
const rateLimiters = new Map<string, RateLimiterRedis>();

// Initialize rate limiters with Redis backend for distributed rate limiting
export async function initRateLimiters() {
  const redis = await getRedisClient();

  // Standard API endpoints - 100 requests per minute
  rateLimiters.set("standard", new RateLimiterRedis({
    storeClient: redis,
    keyPrefix: "rl:standard",
    points: 100,
    duration: 60,
    blockDuration: 60,
  }));

  // Auth endpoints - 10 requests per minute (prevent brute force)
  rateLimiters.set("auth", new RateLimiterRedis({
    storeClient: redis,
    keyPrefix: "rl:auth",
    points: 10,
    duration: 60,
    blockDuration: 300, // Block for 5 minutes after limit exceeded
  }));

  // Heavy operations - 10 requests per minute
  rateLimiters.set("heavy", new RateLimiterRedis({
    storeClient: redis,
    keyPrefix: "rl:heavy",
    points: 10,
    duration: 60,
    blockDuration: 60,
  }));

  // Health checks - 1000 requests per minute
  rateLimiters.set("health", new RateLimiterRedis({
    storeClient: redis,
    keyPrefix: "rl:health",
    points: 1000,
    duration: 60,
    blockDuration: 10,
  }));
}

export function rateLimit(tier: "standard" | "auth" | "heavy" | "health" = "standard") {
  return async (req: Request, res: Response, next: NextFunction) => {
    const limiter = rateLimiters.get(tier);
    if (!limiter) {
      // If rate limiter not initialized, allow request but log warning
      console.error(`Rate limiter for tier ${tier} not initialized`);
      return next();
    }

    // Use IP + user ID (if authenticated) as key
    const key = req.user ? `${req.ip}:${req.user.id}` : req.ip;

    try {
      await limiter.consume(key);

      // Add rate limit headers
      const rateLimiterRes = await limiter.get(key);
      if (rateLimiterRes) {
        res.setHeader("X-RateLimit-Limit", limiter.points.toString());
        res.setHeader("X-RateLimit-Remaining", rateLimiterRes.remainingPoints.toString());
        res.setHeader("X-RateLimit-Reset", new Date(Date.now() + rateLimiterRes.msBeforeNext).toISOString());
      }

      next();
    } catch (rateLimiterRes) {
      // Rate limit exceeded
      res.setHeader("Retry-After", Math.round(rateLimiterRes.msBeforeNext / 1000).toString());
      res.setHeader("X-RateLimit-Limit", limiter.points.toString());
      res.setHeader("X-RateLimit-Remaining", "0");
      res.setHeader("X-RateLimit-Reset", new Date(Date.now() + rateLimiterRes.msBeforeNext).toISOString());

      res.status(429).json({
        error: "TOO_MANY_REQUESTS",
        message: "Rate limit exceeded. Please try again later.",
        retryAfter: Math.round(rateLimiterRes.msBeforeNext / 1000),
      });
    }
  };
}