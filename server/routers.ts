import { COOKIE_NAME } from "../shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { publicProcedure, router, protectedProcedure } from "./_core/trpc";
import { z } from "zod";
import { User, InsertUser, users, athletes, InsertAthlete, weightEntries, InsertWeightEntry, liftRecords, InsertLiftRecord } from "../drizzle/schema";
import { getAllAthletes, getAthleteById, getLiftRecordsForAthlete, getWeightEntriesForAthlete, addLiftRecord, addWeightEntry, updateLiftRecord, updateAthlete, getLeaderboardByExercise, importAthlete, enforceAthleteOwnership, linkUserToAthlete, getAllGyms, getGymById, getGymBySlug, getGymByInviteCode, createGym, updateAthleteGym, getAllUsers, updateUserRole, requestGymAdd, getAllGymRequests, updateGymRequestStatus, getGymRequestById } from "./db";

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
      .input(z.object({
        exercise: z.string(),
        gymId: z.number().optional()
      }))
      .query(({ input }) => getLeaderboardByExercise(input.exercise, input.gymId)),
  }),

  gym: router({
    getAll: publicProcedure.query(() => getAllGyms()),

    getById: publicProcedure
      .input(z.object({ id: z.number() }))
      .query(({ input }) => getGymById(input.id)),

    getBySlug: publicProcedure
      .input(z.object({ slug: z.string() }))
      .query(({ input }) => getGymBySlug(input.slug)),

    join: protectedProcedure
      .input(z.object({ inviteCode: z.string() }))
      .mutation(async ({ input, ctx }) => {
        if (!ctx.user || !ctx.user.athleteId) throw new Error("No athlete profile found");
        const gym = await getGymByInviteCode(input.inviteCode);
        if (!gym) throw new Error("Invalid invite code");

        await updateAthleteGym(ctx.user.athleteId, gym.id);
        return gym;
      }),

    create: protectedProcedure
      .input(z.object({
        name: z.string(),
        slug: z.string(),
        inviteCode: z.string(),
      }))
      .mutation(async ({ input, ctx }) => {
        if (!ctx.user) throw new Error("Unauthorized");
        if (ctx.user.role !== 'admin') throw new Error("Unauthorized: Only admins can create gyms directly");
        const gym = await createGym({
          ...input,
          createdBy: ctx.user.id,
        });

        if (gym && ctx.user.athleteId) {
          await updateAthleteGym(ctx.user.athleteId, gym.id);
        }

        return gym;
      }),

    leave: protectedProcedure
      .mutation(async ({ ctx }) => {
        if (!ctx.user || !ctx.user.athleteId) throw new Error("No athlete profile found");
        await updateAthleteGym(ctx.user.athleteId, null);
        return { success: true };
      }),

    requestAdd: protectedProcedure
      .input(z.object({ name: z.string(), location: z.string().optional() }))
      .mutation(async ({ input, ctx }) => {
        if (!ctx.user) throw new Error("Unauthorized");

        // The user requested that gyms are directly added.
        // We create the gym immediately and record the request as approved.
        const slug = input.name.toLowerCase().trim().replace(/\s+/g, '-').replace(/[^\w\-]+/g, '');
        const prefix = (input.name.match(/[A-Z]/g) || input.name.substring(0, 3).toUpperCase().split('')).slice(0, 3).join('').toUpperCase().padEnd(3, 'X');
        const inviteCode = `${prefix}${Math.floor(100 + Math.random() * 899)}`;

        const gym = await createGym({
          name: input.name,
          slug,
          inviteCode,
          createdBy: ctx.user.id,
        });

        if (gym) {
          await requestGymAdd({
            name: input.name,
            location: input.location,
            requestedBy: ctx.user.id,
            status: 'approved'
          });

          if (ctx.user.athleteId) {
            await updateAthleteGym(ctx.user.athleteId, gym.id);
          }
        }

        return gym;
      }),
  }),

  admin: router({
    listUsers: protectedProcedure.query(async ({ ctx }) => {
      if (ctx.user?.role !== 'admin') throw new Error("Unauthorized");
      return getAllUsers();
    }),
    setUserRole: protectedProcedure
      .input(z.object({ userId: z.number(), role: z.enum(['user', 'admin']) }))
      .mutation(async ({ input, ctx }) => {
        if (ctx.user?.role !== 'admin') throw new Error("Unauthorized");
        return updateUserRole(input.userId, input.role);
      }),
    listGymRequests: protectedProcedure.query(async ({ ctx }) => {
      if (ctx.user?.role !== 'admin') throw new Error("Unauthorized");
      return getAllGymRequests();
    }),
    updateGymRequestStatus: protectedProcedure
      .input(z.object({ id: z.number(), status: z.enum(['pending', 'approved', 'rejected']) }))
      .mutation(async ({ input, ctx }) => {
        if (ctx.user?.role !== 'admin') throw new Error("Unauthorized");

        if (input.status === 'approved') {
          const req = await getGymRequestById(input.id);
          if (req && req.status !== 'approved') {
            const slug = req.name.toLowerCase().trim().replace(/\s+/g, '-').replace(/[^\w\-]+/g, '');
            const prefix = (req.name.match(/[A-Z]/g) || req.name.substring(0, 3).toUpperCase().split('')).slice(0, 3).join('').toUpperCase().padEnd(3, 'X');
            const inviteCode = `${prefix}${Math.floor(100 + Math.random() * 899)}`;

            await createGym({
              name: req.name,
              slug,
              inviteCode,
              createdBy: req.requestedBy,
            });
          }
        }

        return updateGymRequestStatus(input.id, input.status as any);
      }),
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
  }),
});

export type AppRouter = typeof appRouter;
