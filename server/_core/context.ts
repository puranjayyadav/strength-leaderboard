import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { User } from "../../drizzle/schema";
import { getSupabaseAdmin } from "../supabase";
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
      const { data: { user: supabaseUser }, error } = await getSupabaseAdmin().auth.getUser(token);

      if (error) {
        console.error("[Context] Supabase auth error:", error);
      }

      if (!error && supabaseUser) {
        // Sync user to our database
        try {
          user = (await db.getUserByOpenId(supabaseUser.id)) ?? null;

          if (!user) {
            console.log(`[Context] Creating new user for openId: ${supabaseUser.id}`);
            await db.upsertUser({
              openId: supabaseUser.id,
              email: supabaseUser.email ?? null,
              name: supabaseUser.user_metadata?.full_name || supabaseUser.email?.split('@')[0] || 'User',
              lastSignedIn: new Date(),
            });
            user = (await db.getUserByOpenId(supabaseUser.id)) ?? null;

            if (!user) {
              console.error(`[Context] Failed to retrieve user after creation: ${supabaseUser.id}`);
            }
          }

          if (user) {
            user = await db.syncUserAthlete(user);
          }
        } catch (dbError) {
          console.error("[Context] Database sync error:", dbError);
        }
      }
    }
  } catch (error) {
    console.error("[Context] General auth error:", error);
    user = null;
  }

  return {
    req: opts.req,
    res: opts.res,
    user,
  };
}
