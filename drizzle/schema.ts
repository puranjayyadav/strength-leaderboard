import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, decimal, date, index } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: int("id").autoincrement().primaryKey(),
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  athleteId: int("athleteId"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * Athletes table - stores athlete profiles with their personal records
 */
export const athletes = mysqlTable("athletes", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
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
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  totalIdx: index("totalIdx").on(table.total),
}));

export type Athlete = typeof athletes.$inferSelect;
export type InsertAthlete = typeof athletes.$inferInsert;

/**
 * Weight entries - tracks body weight changes over time
 */
export const weightEntries = mysqlTable("weightEntries", {
  id: int("id").autoincrement().primaryKey(),
  athleteId: int("athleteId").notNull(),
  weight: decimal("weight", { precision: 6, scale: 2 }).notNull(),
  recordedDate: date("recordedDate").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  athleteIdx: index("athleteIdx").on(table.athleteId),
  dateIdx: index("dateIdx").on(table.recordedDate),
}));

export type WeightEntry = typeof weightEntries.$inferSelect;
export type InsertWeightEntry = typeof weightEntries.$inferInsert;

/**
 * Lift records - tracks individual lift attempts over time
 */
export const liftRecords = mysqlTable("liftRecords", {
  id: int("id").autoincrement().primaryKey(),
  athleteId: int("athleteId").notNull(),
  exerciseType: varchar("exerciseType", { length: 50 }).notNull(), // squat, bench, deadlift, ohp, etc
  weight: decimal("weight", { precision: 6, scale: 2 }).notNull(),
  reps: int("reps").default(1),
  recordedDate: date("recordedDate").notNull(),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  athleteIdx: index("athleteIdx").on(table.athleteId),
  exerciseIdx: index("exerciseIdx").on(table.exerciseType),
  dateIdx: index("dateIdx").on(table.recordedDate),
}));

export type LiftRecord = typeof liftRecords.$inferSelect;
export type InsertLiftRecord = typeof liftRecords.$inferInsert;