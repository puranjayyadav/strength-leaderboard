import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { User } from "../../drizzle/schema";
import { supabaseAdmin } from "../supabase";
import * as db from "../db";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: User | null;
};

export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  let user: User | null = null;

  try {
    const authHeader = opts.req.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      const { data: { user: supabaseUser }, error } = await supabaseAdmin.auth.getUser(token);

      if (!error && supabaseUser) {
        // Sync user to our database
        user = (await db.getUserByOpenId(supabaseUser.id)) ?? null;

        if (!user) {
          await db.upsertUser({
            openId: supabaseUser.id,
            email: supabaseUser.email ?? null,
            name: supabaseUser.user_metadata?.full_name || supabaseUser.email?.split('@')[0] || 'User',
            lastSignedIn: new Date(),
          });
          user = (await db.getUserByOpenId(supabaseUser.id)) ?? null;
        }
      }
    }
  } catch (error) {
    console.error("[Context] Auth error:", error);
    user = null;
  }

  return {
    req: opts.req,
    res: opts.res,
    user,
  };
}
