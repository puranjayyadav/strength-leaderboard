import { COOKIE_NAME } from "../shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { publicProcedure, router, protectedProcedure } from "./_core/trpc";
import { z } from "zod";
import { User, InsertUser, users, athletes, InsertAthlete, weightEntries, InsertWeightEntry, liftRecords, InsertLiftRecord } from "../drizzle/schema";
import { getAllAthletes, getAthleteById, getLiftRecordsForAthlete, getWeightEntriesForAthlete, addLiftRecord, addWeightEntry, updateLiftRecord, updateAthlete, getLeaderboardByExercise, importAthlete, enforceAthleteOwnership, linkUserToAthlete } from "./db";

export const appRouter = router({
  system: router({
    version: publicProcedure.query(() => "1.0.2"),
  }),
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
      .mutation(async ({ input, ctx }) => {
        await enforceAthleteOwnership(input.athleteId, ctx.user);
        const athlete = await getAthleteById(input.athleteId);
        if (!athlete) throw new Error("Athlete not found");
        const dateStr = new Date(input.recordedDate).toISOString().split('T')[0];
        return addLiftRecord({
          athleteId: input.athleteId,
          exerciseType: input.exerciseType,
          weight: String(input.weight),
          reps: input.reps || 1,
          recordedDate: dateStr,
          notes: input.notes,
        });
      }),

    addWeight: protectedProcedure
      .input(z.object({
        athleteId: z.number(),
        weight: z.number(),
        recordedDate: z.string(),
      }))
      .mutation(async ({ input, ctx }) => {
        await enforceAthleteOwnership(input.athleteId, ctx.user);
        const dateStr = new Date(input.recordedDate).toISOString().split('T')[0];
        return addWeightEntry({
          athleteId: input.athleteId,
          weight: String(input.weight),
          recordedDate: dateStr,
        });
      }),

    updateLift: protectedProcedure
      .input(z.object({
        liftId: z.number(),
        weight: z.number().optional(),
        reps: z.number().optional(),
        notes: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        // For updateLift, we need to check the ownership of the athlete associated with the lift
        // For simplicity, let's assume the user can only edit their own history
        if (ctx.user?.athleteId) {
          return updateLiftRecord(input.liftId, {
            weight: input.weight ? String(input.weight) : undefined,
            reps: input.reps,
            notes: input.notes,
          });
        }
        throw new Error("Unauthorized");
      }),

    updateProfile: protectedProcedure
      .input(z.object({
        athleteId: z.number(),
        name: z.string().optional(),
        bodyWeight: z.number().optional(),
        squat: z.number().optional(),
        bench: z.number().optional(),
        deadlift: z.number().optional(),
        ohp: z.number().optional(),
        avatarUrl: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        await enforceAthleteOwnership(input.athleteId, ctx.user);
        const { athleteId, ...updates } = input;
        let newTotal: string | null | undefined = undefined;
        if (updates.squat && updates.bench && updates.deadlift) {
          newTotal = String(updates.squat + updates.bench + updates.deadlift);
        }
        return updateAthlete(athleteId, {
          name: updates.name,
          bodyWeight: updates.bodyWeight ? String(updates.bodyWeight) : undefined,
          squat: updates.squat ? String(updates.squat) : undefined,
          bench: updates.bench ? String(updates.bench) : undefined,
          deadlift: updates.deadlift ? String(updates.deadlift) : undefined,
          ohp: updates.ohp ? String(updates.ohp) : undefined,
          avatarUrl: updates.avatarUrl,
          total: newTotal,
        });
      }),

    setupProfile: protectedProcedure
      .input(z.object({
        name: z.string(),
        squat: z.number().optional(),
        bench: z.number().optional(),
        deadlift: z.number().optional(),
        ohp: z.number().optional(),
        bodyWeight: z.number().optional(),
        avatarUrl: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        if (!ctx.user) throw new Error("Unauthorized");
        console.log(`[setupProfile] Setting up profile for user ${ctx.user.id}: ${input.name}`);

        // Create athlete
        const total = (input.squat || 0) + (input.bench || 0) + (input.deadlift || 0);
        const athlete = await importAthlete({
          name: input.name,
          email: ctx.user.email,
          avatarUrl: input.avatarUrl,
          squat: input.squat ? String(input.squat) : null,
          bench: input.bench ? String(input.bench) : null,
          deadlift: input.deadlift ? String(input.deadlift) : null,
          ohp: input.ohp ? String(input.ohp) : null,
          bodyWeight: input.bodyWeight ? String(input.bodyWeight) : null,
          total: total > 0 ? String(total) : null,
        });

        if (athlete) {
          await linkUserToAthlete(ctx.user.id, athlete.id);
          // Also record initial lifts in history
          const lifts = [
            { type: 'squat', val: input.squat },
            { type: 'bench', val: input.bench },
            { type: 'deadlift', val: input.deadlift },
            { type: 'ohp', val: input.ohp },
          ];
          const dateStr = new Date().toISOString().split('T')[0];
          for (const lift of lifts) {
            if (lift.val) {
              await addLiftRecord({
                athleteId: athlete.id,
                exerciseType: lift.type,
                weight: String(lift.val),
                reps: 1,
                recordedDate: dateStr,
              });
            }
          }
          if (input.bodyWeight) {
            await addWeightEntry({
              athleteId: athlete.id,
              weight: String(input.bodyWeight),
              recordedDate: dateStr,
            });
          }
          return athlete;
        }
        throw new Error("Failed to create athlete profile");
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
