import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import { archiveMission, assignMission, createMission, decideMissionApproval, getLatestReportRecord, getReportHistory, getReportOwner, listAssignableUsers, listMissionApprovals, listMissionAssignments, listMissions, requestMissionApproval, saveReportRecord } from "./db";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { adminProcedure, protectedProcedure, publicProcedure, router } from "./_core/trpc";

const reportInput = z.object({
  missionId: z.string().min(1).max(128),
  title: z.string().min(1).max(255),
  scope: z.string().min(1).max(10_000),
  status: z.string().min(1).max(64),
  summary: z.string().min(1).max(20_000),
  findingSnapshot: z.unknown(),
  evidenceSnapshot: z.unknown(),
});

const missionInput = z.object({
  missionKey: z.string().min(4).max(128).regex(/^[A-Za-z0-9_-]+$/, "Use letters, numbers, hyphens, or underscores only."),
  title: z.string().min(3).max(255),
  account: z.string().min(2).max(255),
  scope: z.string().min(3).max(10_000),
  risk: z.enum(["critical", "high", "medium", "low", "info"]),
});

const missionActor = (user: { id: number; role: "user" | "admin" }) => ({ id: user.id, role: user.role });

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
  missions: router({
    list: protectedProcedure.input(z.object({ includeArchived: z.boolean().optional() }).optional()).query(({ ctx, input }) => listMissions(missionActor(ctx.user), input?.includeArchived ?? false)),
    create: protectedProcedure.input(missionInput).mutation(({ ctx, input }) => createMission(ctx.user.id, input)),
    archive: protectedProcedure.input(z.object({ missionId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
      const result = await archiveMission(missionActor(ctx.user), input.missionId);
      if (!result) throw new TRPCError({ code: "NOT_FOUND", message: "Mission was not found or is outside your workspace." });
      return result;
    }),
    assignments: protectedProcedure.input(z.object({ missionId: z.number().int().positive() })).query(async ({ ctx, input }) => {
      const result = await listMissionAssignments(missionActor(ctx.user), input.missionId);
      if (!result) throw new TRPCError({ code: "NOT_FOUND", message: "Mission was not found or is outside your workspace." });
      return result;
    }),
    assign: protectedProcedure.input(z.object({ missionId: z.number().int().positive(), userId: z.number().int().positive(), role: z.enum(["analyst", "reviewer", "approver"]) })).mutation(async ({ ctx, input }) => {
      const result = await assignMission(missionActor(ctx.user), input.missionId, input.userId, input.role);
      if (!result) throw new TRPCError({ code: "NOT_FOUND", message: "Mission was not found or is outside your workspace." });
      return result;
    }),
    users: adminProcedure.query(() => listAssignableUsers()),
    approvals: protectedProcedure.input(z.object({ missionId: z.number().int().positive().optional() }).optional()).query(({ ctx, input }) => listMissionApprovals(missionActor(ctx.user), input?.missionId)),
    requestApproval: protectedProcedure.input(z.object({ missionId: z.number().int().positive(), type: z.string().min(3).max(128), summary: z.string().min(3).max(10_000), assignedApproverId: z.number().int().positive().nullable().optional() })).mutation(async ({ ctx, input }) => {
      const result = await requestMissionApproval(missionActor(ctx.user), input.missionId, input);
      if (!result) throw new TRPCError({ code: "NOT_FOUND", message: "Mission was not found or is outside your workspace." });
      return result;
    }),
    decideApproval: protectedProcedure.input(z.object({ approvalId: z.number().int().positive(), decision: z.enum(["approved", "rejected"]), decisionNote: z.string().max(10_000).default("") })).mutation(async ({ ctx, input }) => {
      const result = await decideMissionApproval(missionActor(ctx.user), input.approvalId, input.decision, input.decisionNote);
      if (!result) throw new TRPCError({ code: "NOT_FOUND", message: "Approval request was not found." });
      return result[0];
    }),
  }),
});

export type AppRouter = typeof appRouter;
