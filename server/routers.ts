import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router, protectedProcedure } from "./_core/trpc";
import { z } from "zod";
import { getAllAthletes, getAthleteById, getLiftRecordsForAthlete, getWeightEntriesForAthlete, addLiftRecord, addWeightEntry, updateLiftRecord, updateAthlete, getLeaderboardByExercise, importAthlete } from "./db";

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),

  leaderboard: router({
    getAll: publicProcedure.query(() => getAllAthletes()),
    getByExercise: publicProcedure
      .input(z.object({ exercise: z.string() }))
      .query(({ input }) => getLeaderboardByExercise(input.exercise)),
  }),

  athlete: router({
    getById: publicProcedure
      .input(z.object({ id: z.number() }))
      .query(({ input }) => getAthleteById(input.id)),

    getLiftHistory: publicProcedure
      .input(z.object({ athleteId: z.number(), exerciseType: z.string().optional() }))
      .query(({ input }) => getLiftRecordsForAthlete(input.athleteId, input.exerciseType)),

    getWeightHistory: publicProcedure
      .input(z.object({ athleteId: z.number() }))
      .query(({ input }) => getWeightEntriesForAthlete(input.athleteId)),

    addLift: protectedProcedure
      .input(z.object({
        athleteId: z.number(),
        exerciseType: z.string(),
        weight: z.number(),
        reps: z.number().optional(),
        recordedDate: z.string(),
        notes: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const athlete = await getAthleteById(input.athleteId);
        if (!athlete) throw new Error("Athlete not found");
        const date = new Date(input.recordedDate);
        return addLiftRecord({
          athleteId: input.athleteId,
          exerciseType: input.exerciseType,
          weight: String(input.weight),
          reps: input.reps || 1,
          recordedDate: date,
          notes: input.notes,
        });
      }),

    addWeight: protectedProcedure
      .input(z.object({
        athleteId: z.number(),
        weight: z.number(),
        recordedDate: z.string(),
      }))
      .mutation(async ({ input }) => {
        const date = new Date(input.recordedDate);
        return addWeightEntry({
          athleteId: input.athleteId,
          weight: String(input.weight),
          recordedDate: date,
        });
      }),

    updateLift: protectedProcedure
      .input(z.object({
        liftId: z.number(),
        weight: z.number().optional(),
        reps: z.number().optional(),
        notes: z.string().optional(),
      }))
      .mutation(({ input }) => {
        return updateLiftRecord(input.liftId, {
          weight: input.weight ? String(input.weight) : undefined,
          reps: input.reps,
          notes: input.notes,
        });
      }),

    updateProfile: protectedProcedure
      .input(z.object({
        athleteId: z.number(),
        bodyWeight: z.number().optional(),
        squat: z.number().optional(),
        bench: z.number().optional(),
        deadlift: z.number().optional(),
        ohp: z.number().optional(),
      }))
      .mutation(async ({ input }) => {
        const { athleteId, ...updates } = input;
        let newTotal: string | null | undefined = undefined;
        if (updates.squat && updates.bench && updates.deadlift) {
          newTotal = String(updates.squat + updates.bench + updates.deadlift);
        }
        return updateAthlete(athleteId, {
          bodyWeight: updates.bodyWeight ? String(updates.bodyWeight) : null,
          squat: updates.squat ? String(updates.squat) : null,
          bench: updates.bench ? String(updates.bench) : null,
          deadlift: updates.deadlift ? String(updates.deadlift) : null,
          ohp: updates.ohp ? String(updates.ohp) : null,
          total: newTotal,
        });
      }),

    importData: protectedProcedure
      .input(z.string())
      .mutation(async ({ input }) => {
        const lines = input.split('\n');
        let successCount = 0;
        let errorCount = 0;
        const errors: string[] = [];

        for (const line of lines) {
          if (!line.trim()) continue;

          const parts = line.split('\t');
          // Handle potential header row
          if (parts[0]?.trim().toLowerCase() === 'name') continue;

          // Name (0), Bw (1), Squat (2), Bench (3), Deadlift (4), Total (5), OHP (6), Incline Bench (7), RDL (8), Rev Band Bench (9), Rev Band Squat (10), Rev Band DL (11), Slingshot Bench (12)

          const name = parts[0]?.trim();
          if (!name) continue;

          const parseVal = (val: string | undefined) => {
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
          } catch (e: any) {
            errorCount++;
            errors.push(`Failed to import ${name}: ${e.message}`);
          }
        }

        return { successCount, errorCount, errors };
      }),
  }),
});

export type AppRouter = typeof appRouter;
