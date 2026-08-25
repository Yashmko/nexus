/** NEXUS tRPC contract for authenticated report-record persistence. */
import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import { getLatestReportRecord, getReportHistory, getReportOwner, saveReportRecord } from "./db";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";

const reportInput = z.object({
  missionId: z.string().min(1).max(128),
  title: z.string().min(1).max(255),
  scope: z.string().min(1).max(10_000),
  status: z.string().min(1).max(64),
  summary: z.string().min(1).max(20_000),
  findingSnapshot: z.unknown(),
  evidenceSnapshot: z.unknown(),
});

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(({ ctx }) => ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),
  reports: router({
    latest: protectedProcedure.input(z.object({ missionId: z.string().min(1).max(128) })).query(({ ctx, input }) => getLatestReportRecord(ctx.user.id, input.missionId)),
    history: protectedProcedure.input(z.object({ missionId: z.string().min(1).max(128) })).query(({ ctx, input }) => getReportHistory(ctx.user.id, input.missionId)),
    owner: protectedProcedure.input(z.object({ reportId: z.number().int().positive() })).query(({ ctx, input }) => getReportOwner(ctx.user.id, input.reportId)),
    save: protectedProcedure.input(reportInput).mutation(({ ctx, input }) => saveReportRecord(ctx.user.id, input)),
  }),
});

export type AppRouter = typeof appRouter;
