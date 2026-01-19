// server/_core/index.ts
import "dotenv/config";
import express2 from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";

// shared/const.ts
var COOKIE_NAME = "app_session_id";
var ONE_YEAR_MS = 1e3 * 60 * 60 * 24 * 365;
var UNAUTHED_ERR_MSG = "Please login (10001)";
var NOT_ADMIN_ERR_MSG = "You do not have required permission (10002)";

// server/_core/cookies.ts
function isSecureRequest(req) {
  if (req.protocol === "https") return true;
  const forwardedProto = req.headers["x-forwarded-proto"];
  if (!forwardedProto) return false;
  const protoList = Array.isArray(forwardedProto) ? forwardedProto : forwardedProto.split(",");
  return protoList.some((proto) => proto.trim().toLowerCase() === "https");
}
function getSessionCookieOptions(req) {
  return {
    httpOnly: true,
    path: "/",
    sameSite: "none",
    secure: isSecureRequest(req)
  };
}

// server/_core/trpc.ts
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
var t = initTRPC.context().create({
  transformer: superjson
});
var router = t.router;
var publicProcedure = t.procedure;
var requireUser = t.middleware(async (opts) => {
  const { ctx, next } = opts;
  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  }
  return next({
    ctx: {
      ...ctx,
      user: ctx.user
    }
  });
});
var protectedProcedure = t.procedure.use(requireUser);
var adminProcedure = t.procedure.use(
  t.middleware(async (opts) => {
    const { ctx, next } = opts;
    if (!ctx.user || ctx.user.role !== "admin") {
      throw new TRPCError({ code: "FORBIDDEN", message: NOT_ADMIN_ERR_MSG });
    }
    return next({
      ctx: {
        ...ctx,
        user: ctx.user
      }
    });
  })
);

// server/routers.ts
import { z } from "zod";

// server/db.ts
import { eq, and, desc, asc } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import pkg from "pg";

// drizzle/schema.ts
import { integer, pgEnum, pgTable, text, timestamp, varchar, decimal, date, index, serial } from "drizzle-orm/pg-core";
var roleEnum = pgEnum("role", ["user", "admin"]);
var users = pgTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: serial("id").primaryKey(),
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: roleEnum("role").default("user").notNull(),
  athleteId: integer("athleteId"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull()
});
var athletes = pgTable("athletes", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull().unique(),
  bodyWeight: decimal("bodyWeight", { precision: 6, scale: 2 }),
  squat: decimal("squat", { precision: 6, scale: 2 }),
  bench: decimal("bench", { precision: 6, scale: 2 }),
  deadlift: decimal("deadlift", { precision: 6, scale: 2 }),
  total: decimal("total", { precision: 8, scale: 2 }),
  ohp: decimal("ohp", { precision: 6, scale: 2 }),
  inclineBench: decimal("inclineBench", { precision: 6, scale: 2 }),
  rdl: decimal("rdl", { precision: 6, scale: 2 }),
  revBandBench: decimal("revBandBench", { precision: 6, scale: 2 }),
  revBandSquat: decimal("revBandSquat", { precision: 6, scale: 2 }),
  revBandDl: decimal("revBandDl", { precision: 6, scale: 2 }),
  slingshotBench: decimal("slingshotBench", { precision: 6, scale: 2 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull()
}, (table) => ({
  totalIdx: index("athletes_total_idx").on(table.total)
}));
var weightEntries = pgTable("weightEntries", {
  id: serial("id").primaryKey(),
  athleteId: integer("athleteId").notNull(),
  weight: decimal("weight", { precision: 6, scale: 2 }).notNull(),
  recordedDate: date("recordedDate").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull()
}, (table) => ({
  athleteIdx: index("weightEntries_athlete_idx").on(table.athleteId),
  dateIdx: index("weightEntries_date_idx").on(table.recordedDate)
}));
var liftRecords = pgTable("liftRecords", {
  id: serial("id").primaryKey(),
  athleteId: integer("athleteId").notNull(),
  exerciseType: varchar("exerciseType", { length: 50 }).notNull(),
  // squat, bench, deadlift, ohp, etc
  weight: decimal("weight", { precision: 6, scale: 2 }).notNull(),
  reps: integer("reps").default(1),
  recordedDate: date("recordedDate").notNull(),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull()
}, (table) => ({
  athleteIdx: index("liftRecords_athlete_idx").on(table.athleteId),
  exerciseIdx: index("liftRecords_exercise_idx").on(table.exerciseType),
  dateIdx: index("liftRecords_date_idx").on(table.recordedDate)
}));

// server/db.ts
var { Pool } = pkg;
var _db = null;
var _pool = null;
async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _pool = new Pool({
        connectionString: process.env.DATABASE_URL
      });
      _db = drizzle(_pool);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}
async function upsertUser(user) {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }
  try {
    const values = {
      openId: user.openId
    };
    const updateSet = {};
    const textFields = ["name", "email", "loginMethod"];
    const assignNullable = (field) => {
      const value = user[field];
      if (value === void 0) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };
    textFields.forEach(assignNullable);
    if (user.lastSignedIn !== void 0) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== void 0) {
      values.role = user.role;
      updateSet.role = user.role;
    }
    if (!values.lastSignedIn) {
      values.lastSignedIn = /* @__PURE__ */ new Date();
    }
    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = /* @__PURE__ */ new Date();
    }
    await db.insert(users).values(values).onConflictDoUpdate({
      target: users.openId,
      set: updateSet
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}
async function getUserByOpenId(openId) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return void 0;
  }
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : void 0;
}
async function getAllAthletes() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(athletes).orderBy(desc(athletes.total));
}
async function getAthleteById(id) {
  const db = await getDb();
  if (!db) return void 0;
  const result = await db.select().from(athletes).where(eq(athletes.id, id)).limit(1);
  return result.length > 0 ? result[0] : void 0;
}
async function getAthleteByName(name) {
  const db = await getDb();
  if (!db) return void 0;
  const result = await db.select().from(athletes).where(eq(athletes.name, name)).limit(1);
  return result.length > 0 ? result[0] : void 0;
}
async function updateAthlete(id, data) {
  const db = await getDb();
  if (!db) return void 0;
  await db.update(athletes).set(data).where(eq(athletes.id, id));
  return getAthleteById(id);
}
async function importAthlete(data) {
  const db = await getDb();
  if (!db) return void 0;
  if (!data.name) {
    throw new Error("Athlete name is required for import");
  }
  const existing = await getAthleteByName(data.name);
  if (existing) {
    await db.update(athletes).set(data).where(eq(athletes.id, existing.id));
    return getAthleteById(existing.id);
  } else {
    await db.insert(athletes).values(data);
    return getAthleteByName(data.name);
  }
}
async function getWeightEntriesForAthlete(athleteId) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(weightEntries).where(eq(weightEntries.athleteId, athleteId)).orderBy(asc(weightEntries.recordedDate));
}
async function addWeightEntry(data) {
  const db = await getDb();
  if (!db) return void 0;
  const result = await db.insert(weightEntries).values(data);
  return result;
}
async function getLiftRecordsForAthlete(athleteId, exerciseType) {
  const db = await getDb();
  if (!db) return [];
  if (exerciseType) {
    return db.select().from(liftRecords).where(
      and(eq(liftRecords.athleteId, athleteId), eq(liftRecords.exerciseType, exerciseType))
    ).orderBy(asc(liftRecords.recordedDate));
  }
  return db.select().from(liftRecords).where(eq(liftRecords.athleteId, athleteId)).orderBy(asc(liftRecords.recordedDate));
}
async function addLiftRecord(data) {
  const db = await getDb();
  if (!db) return void 0;
  const result = await db.insert(liftRecords).values(data);
  return result;
}
async function updateLiftRecord(id, data) {
  const db = await getDb();
  if (!db) return void 0;
  return db.update(liftRecords).set(data).where(eq(liftRecords.id, id));
}
async function getLeaderboardByExercise(exerciseType) {
  const db = await getDb();
  if (!db) return [];
  if (exerciseType === "total") {
    return db.select().from(athletes).orderBy(desc(athletes.total));
  } else if (exerciseType === "squat") {
    return db.select().from(athletes).orderBy(desc(athletes.squat));
  } else if (exerciseType === "bench") {
    return db.select().from(athletes).orderBy(desc(athletes.bench));
  } else if (exerciseType === "deadlift") {
    return db.select().from(athletes).orderBy(desc(athletes.deadlift));
  } else if (exerciseType === "ohp") {
    return db.select().from(athletes).orderBy(desc(athletes.ohp));
  }
  return db.select().from(athletes).orderBy(desc(athletes.total));
}
async function enforceAthleteOwnership(athleteId, user) {
  if (!user) {
    throw new Error("Unauthorized");
  }
  if (user.role === "admin") return;
  if (user.athleteId !== athleteId) {
    throw new Error("You do not have permission to edit this athlete profile");
  }
}
async function linkUserToAthlete(userId, athleteId) {
  const db = await getDb();
  if (!db) return;
  await db.update(users).set({ athleteId }).where(eq(users.id, userId));
}
async function syncUserAthlete(user) {
  if (user.athleteId) return user;
  const db = await getDb();
  if (!db) return user;
  const existingAthlete = await getAthleteByName(user.name || "");
  if (existingAthlete) {
    await linkUserToAthlete(user.id, existingAthlete.id);
    return { ...user, athleteId: existingAthlete.id };
  }
  return user;
}

// server/routers.ts
var appRouter = router({
  system: router({
    version: publicProcedure.query(() => "1.0.2")
  }),
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true
      };
    })
  }),
  leaderboard: router({
    getAll: publicProcedure.query(() => getAllAthletes()),
    getByExercise: publicProcedure.input(z.object({ exercise: z.string() })).query(({ input }) => getLeaderboardByExercise(input.exercise))
  }),
  athlete: router({
    getById: publicProcedure.input(z.object({ id: z.number() })).query(({ input }) => getAthleteById(input.id)),
    getLiftHistory: publicProcedure.input(z.object({ athleteId: z.number(), exerciseType: z.string().optional() })).query(({ input }) => getLiftRecordsForAthlete(input.athleteId, input.exerciseType)),
    getWeightHistory: publicProcedure.input(z.object({ athleteId: z.number() })).query(({ input }) => getWeightEntriesForAthlete(input.athleteId)),
    addLift: protectedProcedure.input(z.object({
      athleteId: z.number(),
      exerciseType: z.string(),
      weight: z.number(),
      reps: z.number().optional(),
      recordedDate: z.string(),
      notes: z.string().optional()
    })).mutation(async ({ input, ctx }) => {
      await enforceAthleteOwnership(input.athleteId, ctx.user);
      const athlete = await getAthleteById(input.athleteId);
      if (!athlete) throw new Error("Athlete not found");
      const dateStr = new Date(input.recordedDate).toISOString().split("T")[0];
      return addLiftRecord({
        athleteId: input.athleteId,
        exerciseType: input.exerciseType,
        weight: String(input.weight),
        reps: input.reps || 1,
        recordedDate: dateStr,
        notes: input.notes
      });
    }),
    addWeight: protectedProcedure.input(z.object({
      athleteId: z.number(),
      weight: z.number(),
      recordedDate: z.string()
    })).mutation(async ({ input, ctx }) => {
      await enforceAthleteOwnership(input.athleteId, ctx.user);
      const dateStr = new Date(input.recordedDate).toISOString().split("T")[0];
      return addWeightEntry({
        athleteId: input.athleteId,
        weight: String(input.weight),
        recordedDate: dateStr
      });
    }),
    updateLift: protectedProcedure.input(z.object({
      liftId: z.number(),
      weight: z.number().optional(),
      reps: z.number().optional(),
      notes: z.string().optional()
    })).mutation(async ({ input, ctx }) => {
      if (ctx.user?.athleteId) {
        return updateLiftRecord(input.liftId, {
          weight: input.weight ? String(input.weight) : void 0,
          reps: input.reps,
          notes: input.notes
        });
      }
      throw new Error("Unauthorized");
    }),
    updateProfile: protectedProcedure.input(z.object({
      athleteId: z.number(),
      bodyWeight: z.number().optional(),
      squat: z.number().optional(),
      bench: z.number().optional(),
      deadlift: z.number().optional(),
      ohp: z.number().optional()
    })).mutation(async ({ input, ctx }) => {
      await enforceAthleteOwnership(input.athleteId, ctx.user);
      const { athleteId, ...updates } = input;
      let newTotal = void 0;
      if (updates.squat && updates.bench && updates.deadlift) {
        newTotal = String(updates.squat + updates.bench + updates.deadlift);
      }
      return updateAthlete(athleteId, {
        bodyWeight: updates.bodyWeight ? String(updates.bodyWeight) : null,
        squat: updates.squat ? String(updates.squat) : null,
        bench: updates.bench ? String(updates.bench) : null,
        deadlift: updates.deadlift ? String(updates.deadlift) : null,
        ohp: updates.ohp ? String(updates.ohp) : null,
        total: newTotal
      });
    }),
    setupProfile: protectedProcedure.input(z.object({
      name: z.string(),
      squat: z.number().optional(),
      bench: z.number().optional(),
      deadlift: z.number().optional(),
      ohp: z.number().optional(),
      bodyWeight: z.number().optional()
    })).mutation(async ({ input, ctx }) => {
      if (!ctx.user) throw new Error("Unauthorized");
      console.log(`[setupProfile] Setting up profile for user ${ctx.user.id}: ${input.name}`);
      const total = (input.squat || 0) + (input.bench || 0) + (input.deadlift || 0);
      const athlete = await importAthlete({
        name: input.name,
        squat: input.squat ? String(input.squat) : null,
        bench: input.bench ? String(input.bench) : null,
        deadlift: input.deadlift ? String(input.deadlift) : null,
        ohp: input.ohp ? String(input.ohp) : null,
        bodyWeight: input.bodyWeight ? String(input.bodyWeight) : null,
        total: total > 0 ? String(total) : null
      });
      if (athlete) {
        await linkUserToAthlete(ctx.user.id, athlete.id);
        const lifts = [
          { type: "squat", val: input.squat },
          { type: "bench", val: input.bench },
          { type: "deadlift", val: input.deadlift },
          { type: "ohp", val: input.ohp }
        ];
        const dateStr = (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
        for (const lift of lifts) {
          if (lift.val) {
            await addLiftRecord({
              athleteId: athlete.id,
              exerciseType: lift.type,
              weight: String(lift.val),
              reps: 1,
              recordedDate: dateStr
            });
          }
        }
        if (input.bodyWeight) {
          await addWeightEntry({
            athleteId: athlete.id,
            weight: String(input.bodyWeight),
            recordedDate: dateStr
          });
        }
        return athlete;
      }
      throw new Error("Failed to create athlete profile");
    }),
    importData: protectedProcedure.input(z.string()).mutation(async ({ input }) => {
      const lines = input.split("\n");
      let successCount = 0;
      let errorCount = 0;
      const errors = [];
      for (const line of lines) {
        if (!line.trim()) continue;
        const parts = line.split("	");
        if (parts[0]?.trim().toLowerCase() === "name") continue;
        const name = parts[0]?.trim();
        if (!name) continue;
        const parseVal = (val) => {
          if (!val || !val.trim()) return null;
          const num = parseFloat(val);
          return isNaN(num) ? null : String(num);
        };
        const bodyWeight = parseVal(parts[1]);
        const squat = parseVal(parts[2]);
        const bench = parseVal(parts[3]);
        const deadlift = parseVal(parts[4]);
        let total = null;
        if (squat && bench && deadlift) {
          total = String(parseFloat(squat) + parseFloat(bench) + parseFloat(deadlift));
        }
        const ohp = parseVal(parts[6]);
        const inclineBench = parseVal(parts[7]);
        const rdl = parseVal(parts[8]);
        const revBandBench = parseVal(parts[9]);
        const revBandSquat = parseVal(parts[10]);
        const revBandDl = parseVal(parts[11]);
        const slingshotBench = parseVal(parts[12]);
        try {
          await importAthlete({
            name,
            bodyWeight,
            squat,
            bench,
            deadlift,
            total,
            ohp,
            inclineBench,
            rdl,
            revBandBench,
            revBandSquat,
            revBandDl,
            slingshotBench
          });
          successCount++;
        } catch (e) {
          errorCount++;
          errors.push(`Failed to import ${name}: ${e.message}`);
        }
      }
      return { successCount, errorCount, errors };
    })
  })
});

// server/supabase.ts
import { createClient } from "@supabase/supabase-js";
var _supabaseAdmin = null;
function getSupabaseAdmin() {
  if (!_supabaseAdmin) {
    const supabaseUrl = process.env.VITE_SUPABASE_URL || "";
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Supabase URL and Service Role Key are required for server-side operations");
    }
    _supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
  }
  return _supabaseAdmin;
}

// server/_core/context.ts
async function createContext(opts) {
  let user = null;
  try {
    const authHeader = opts.req.headers.authorization;
    if (authHeader?.startsWith("Bearer ")) {
      const token = authHeader.split(" ")[1];
      const { data: { user: supabaseUser }, error } = await getSupabaseAdmin().auth.getUser(token);
      if (!error && supabaseUser) {
        user = await getUserByOpenId(supabaseUser.id) ?? null;
        if (!user) {
          await upsertUser({
            openId: supabaseUser.id,
            email: supabaseUser.email ?? null,
            name: supabaseUser.user_metadata?.full_name || supabaseUser.email?.split("@")[0] || "User",
            lastSignedIn: /* @__PURE__ */ new Date()
          });
          user = await getUserByOpenId(supabaseUser.id) ?? null;
        }
        if (user) {
          user = await syncUserAthlete(user);
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
    user
  };
}

// server/_core/vite.ts
import express from "express";
import fs from "fs";
import { nanoid } from "nanoid";
import path2 from "path";
import { createServer as createViteServer } from "vite";

// vite.config.ts
import { jsxLocPlugin } from "@builder.io/vite-plugin-jsx-loc";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { defineConfig } from "vite";
import { vitePluginManusRuntime } from "vite-plugin-manus-runtime";
var plugins = [react(), tailwindcss(), jsxLocPlugin(), vitePluginManusRuntime()];
var vite_config_default = defineConfig({
  plugins,
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
      "@assets": path.resolve(import.meta.dirname, "attached_assets")
    }
  },
  envDir: path.resolve(import.meta.dirname),
  root: path.resolve(import.meta.dirname, "client"),
  publicDir: path.resolve(import.meta.dirname, "client", "public"),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist"),
    emptyOutDir: true
  },
  server: {
    host: true,
    allowedHosts: [
      ".manuspre.computer",
      ".manus.computer",
      ".manus-asia.computer",
      ".manuscomputer.ai",
      ".manusvm.computer",
      "localhost",
      "127.0.0.1"
    ],
    fs: {
      strict: true,
      deny: ["**/.*"]
    }
  }
});

// server/_core/vite.ts
async function setupVite(app, server) {
  const serverOptions = {
    middlewareMode: true,
    hmr: { server },
    allowedHosts: true
  };
  const vite = await createViteServer({
    ...vite_config_default,
    configFile: false,
    server: serverOptions,
    appType: "custom"
  });
  app.use(vite.middlewares);
  app.use("*", async (req, res, next) => {
    const url = req.originalUrl;
    try {
      const clientTemplate = path2.resolve(
        import.meta.dirname,
        "../..",
        "client",
        "index.html"
      );
      let template = await fs.promises.readFile(clientTemplate, "utf-8");
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid()}"`
      );
      const page = await vite.transformIndexHtml(url, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e);
      next(e);
    }
  });
}
function serveStatic(app) {
  const distPath = process.env.NODE_ENV === "development" ? path2.resolve(import.meta.dirname, "../..", "dist", "public") : path2.resolve(import.meta.dirname, "public");
  if (!fs.existsSync(distPath)) {
    console.error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`
    );
  }
  app.use(express.static(distPath));
  app.use("*", (_req, res) => {
    res.sendFile(path2.resolve(distPath, "index.html"));
  });
}

// server/_core/index.ts
function isPortAvailable(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}
async function findAvailablePort(startPort = 3e3) {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}
async function startServer() {
  const app = express2();
  const server = createServer(app);
  app.use(express2.json({ limit: "50mb" }));
  app.use(express2.urlencoded({ limit: "50mb", extended: true }));
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext
    })
  );
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }
  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);
  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }
  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}
startServer().catch(console.error);
