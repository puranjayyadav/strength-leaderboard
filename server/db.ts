import { eq, and, desc, asc } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, users, athletes, InsertAthlete, weightEntries, InsertWeightEntry, liftRecords, InsertLiftRecord } from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

// Athletes queries
export async function getAllAthletes() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(athletes).orderBy((t) => desc(t.total));
}

export async function getAthleteById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(athletes).where(eq(athletes.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getAthleteByName(name: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(athletes).where(eq(athletes.name, name)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function upsertAthlete(data: InsertAthlete) {
  const db = await getDb();
  if (!db) return undefined;
  await db.insert(athletes).values(data).onDuplicateKeyUpdate({
    set: data,
  });
  return getAthleteByName(data.name!);
}

export async function updateAthlete(id: number, data: Partial<InsertAthlete>) {
  const db = await getDb();
  if (!db) return undefined;
  await db.update(athletes).set(data).where(eq(athletes.id, id));
  return getAthleteById(id);
}

// Weight entries queries
export async function getWeightEntriesForAthlete(athleteId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(weightEntries).where(eq(weightEntries.athleteId, athleteId)).orderBy((t) => asc(t.recordedDate));
}

export async function addWeightEntry(data: InsertWeightEntry) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.insert(weightEntries).values(data);
  return result;
}

// Lift records queries
export async function getLiftRecordsForAthlete(athleteId: number, exerciseType?: string) {
  const db = await getDb();
  if (!db) return [];
  if (exerciseType) {
    return db.select().from(liftRecords).where(
      and(eq(liftRecords.athleteId, athleteId), eq(liftRecords.exerciseType, exerciseType))
    ).orderBy((t) => asc(t.recordedDate));
  }
  return db.select().from(liftRecords).where(eq(liftRecords.athleteId, athleteId)).orderBy((t) => asc(t.recordedDate));
}

export async function addLiftRecord(data: InsertLiftRecord) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.insert(liftRecords).values(data);
  return result;
}

export async function updateLiftRecord(id: number, data: Partial<InsertLiftRecord>) {
  const db = await getDb();
  if (!db) return undefined;
  return db.update(liftRecords).set(data).where(eq(liftRecords.id, id));
}

export async function getLeaderboardByExercise(exerciseType: string) {
  const db = await getDb();
  if (!db) return [];
  
  if (exerciseType === 'total') {
    return db.select().from(athletes).orderBy((t) => desc(t.total));
  } else if (exerciseType === 'squat') {
    return db.select().from(athletes).orderBy((t) => desc(t.squat));
  } else if (exerciseType === 'bench') {
    return db.select().from(athletes).orderBy((t) => desc(t.bench));
  } else if (exerciseType === 'deadlift') {
    return db.select().from(athletes).orderBy((t) => desc(t.deadlift));
  } else if (exerciseType === 'ohp') {
    return db.select().from(athletes).orderBy((t) => desc(t.ohp));
  }
  
  return db.select().from(athletes).orderBy((t) => desc(t.total));
}
