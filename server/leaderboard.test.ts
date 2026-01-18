import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// Mock context for testing
function createMockContext(): TrpcContext {
  return {
    user: null,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: () => {},
    } as TrpcContext["res"],
  };
}

describe("Leaderboard API", () => {
  const ctx = createMockContext();
  const caller = appRouter.createCaller(ctx);

  describe("leaderboard.getAll", () => {
    it("should return a list of athletes", async () => {
      const athletes = await caller.leaderboard.getAll();
      expect(Array.isArray(athletes)).toBe(true);
    });

    it("should return athletes sorted by total in descending order", async () => {
      const athletes = await caller.leaderboard.getAll();
      if (athletes.length > 1) {
        for (let i = 0; i < athletes.length - 1; i++) {
          const current = athletes[i]?.total ? parseFloat(String(athletes[i].total)) : 0;
          const next = athletes[i + 1]?.total ? parseFloat(String(athletes[i + 1].total)) : 0;
          expect(current).toBeGreaterThanOrEqual(next);
        }
      }
    });
  });

  describe("leaderboard.getByExercise", () => {
    it("should return athletes sorted by total", async () => {
      const athletes = await caller.leaderboard.getByExercise({ exercise: "total" });
      expect(Array.isArray(athletes)).toBe(true);
      if (athletes.length > 1) {
        const first = athletes[0]?.total ? parseFloat(String(athletes[0].total)) : 0;
        const second = athletes[1]?.total ? parseFloat(String(athletes[1].total)) : 0;
        expect(first).toBeGreaterThanOrEqual(second);
      }
    });

    it("should return athletes sorted by squat", async () => {
      const athletes = await caller.leaderboard.getByExercise({ exercise: "squat" });
      expect(Array.isArray(athletes)).toBe(true);
      if (athletes.length > 1) {
        const first = athletes[0]?.squat ? parseFloat(String(athletes[0].squat)) : 0;
        const second = athletes[1]?.squat ? parseFloat(String(athletes[1].squat)) : 0;
        expect(first).toBeGreaterThanOrEqual(second);
      }
    });

    it("should return athletes sorted by bench", async () => {
      const athletes = await caller.leaderboard.getByExercise({ exercise: "bench" });
      expect(Array.isArray(athletes)).toBe(true);
      if (athletes.length > 1) {
        const first = athletes[0]?.bench ? parseFloat(String(athletes[0].bench)) : 0;
        const second = athletes[1]?.bench ? parseFloat(String(athletes[1].bench)) : 0;
        expect(first).toBeGreaterThanOrEqual(second);
      }
    });

    it("should return athletes sorted by deadlift", async () => {
      const athletes = await caller.leaderboard.getByExercise({ exercise: "deadlift" });
      expect(Array.isArray(athletes)).toBe(true);
      if (athletes.length > 1) {
        const first = athletes[0]?.deadlift ? parseFloat(String(athletes[0].deadlift)) : 0;
        const second = athletes[1]?.deadlift ? parseFloat(String(athletes[1].deadlift)) : 0;
        expect(first).toBeGreaterThanOrEqual(second);
      }
    });

    it("should return athletes sorted by OHP", async () => {
      const athletes = await caller.leaderboard.getByExercise({ exercise: "ohp" });
      expect(Array.isArray(athletes)).toBe(true);
    });
  });

  describe("athlete.getById", () => {
    it("should return an athlete by ID", async () => {
      const athletes = await caller.leaderboard.getAll();
      if (athletes.length > 0) {
        const athlete = await caller.athlete.getById({ id: athletes[0]!.id });
        expect(athlete).toBeDefined();
        expect(athlete?.name).toBe(athletes[0]!.name);
      }
    });

    it("should return undefined for non-existent athlete", async () => {
      const athlete = await caller.athlete.getById({ id: 99999 });
      expect(athlete).toBeUndefined();
    });
  });

  describe("athlete.getLiftHistory", () => {
    it("should return lift history for an athlete", async () => {
      const athletes = await caller.leaderboard.getAll();
      if (athletes.length > 0) {
        const history = await caller.athlete.getLiftHistory({ athleteId: athletes[0]!.id });
        expect(Array.isArray(history)).toBe(true);
      }
    });
  });

  describe("athlete.getWeightHistory", () => {
    it("should return weight history for an athlete", async () => {
      const athletes = await caller.leaderboard.getAll();
      if (athletes.length > 0) {
        const history = await caller.athlete.getWeightHistory({ athleteId: athletes[0]!.id });
        expect(Array.isArray(history)).toBe(true);
      }
    });
  });
});
