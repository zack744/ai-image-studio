import type { DbType } from "./db";
import type { users } from "./db/schema";

export interface AuthContext {
  userId: string;
  user: typeof users.$inferSelect;
}

export type AppEnv = {
  Bindings: Env;
  Variables: {
    db: DbType;
    auth: AuthContext;
  };
};
