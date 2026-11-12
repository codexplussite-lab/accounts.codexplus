import jwt, { SignOptions } from "jsonwebtoken";
import { env } from "../config/env.js";

export interface TokenPayload {
  userId: string;
}

export function generateAccessToken(userId: string): string {
  const options: SignOptions = {
    expiresIn: "15m"
  };
  return jwt.sign({ userId }, env.JWT_ACCESS_SECRET, options);
}

export function generateRefreshToken(userId: string): string {
  const options: SignOptions = {
    expiresIn: "7d"
  };
  return jwt.sign({ userId }, env.JWT_REFRESH_SECRET, options);
}

export function verifyAccessToken(token: string): TokenPayload {
  return jwt.verify(token, env.JWT_ACCESS_SECRET) as TokenPayload;
}

export function verifyRefreshToken(token: string): TokenPayload {
  return jwt.verify(token, env.JWT_REFRESH_SECRET) as TokenPayload;
}

