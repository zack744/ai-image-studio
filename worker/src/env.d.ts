interface Env {
  DB: D1Database;
  R2?: R2Bucket;
  JWT_SECRET: string;
  R2_PUBLIC_URL?: string;
  ENVIRONMENT?: string;
  SUCHUANG_API_KEY?: string;
  WAVESPEED_API_KEY?: string;
}
