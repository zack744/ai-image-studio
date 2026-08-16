interface Env {
  DB: D1Database;
  R2?: R2Bucket;
  JWT_SECRET: string;
  R2_PUBLIC_URL?: string;
  ENVIRONMENT?: string;
  INVITE_CODE?: string;
}
