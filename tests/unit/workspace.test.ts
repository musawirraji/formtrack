import { describe, expect, it } from "vitest";
import { WORKSPACE_PLAN_LIMITS } from "@/domain/workspace/Workspace";

describe("WORKSPACE_PLAN_LIMITS", () => {
  it("defines every plan tier", () => {
    expect(WORKSPACE_PLAN_LIMITS.free).toBeDefined();
    expect(WORKSPACE_PLAN_LIMITS.starter).toBeDefined();
    expect(WORKSPACE_PLAN_LIMITS.growth).toBeDefined();
    expect(WORKSPACE_PLAN_LIMITS.business).toBeDefined();
  });

  it("limits are monotonically increasing across tiers", () => {
    expect(WORKSPACE_PLAN_LIMITS.starter.submissionsPerMonth).toBeGreaterThan(
      WORKSPACE_PLAN_LIMITS.free.submissionsPerMonth
    );
    expect(WORKSPACE_PLAN_LIMITS.growth.submissionsPerMonth).toBeGreaterThan(
      WORKSPACE_PLAN_LIMITS.starter.submissionsPerMonth
    );
    expect(WORKSPACE_PLAN_LIMITS.business.submissionsPerMonth).toBeGreaterThan(
      WORKSPACE_PLAN_LIMITS.growth.submissionsPerMonth
    );
  });

  it("business tier is unlimited on forms + team", () => {
    expect(WORKSPACE_PLAN_LIMITS.business.forms).toBe(Infinity);
    expect(WORKSPACE_PLAN_LIMITS.business.teamMembers).toBe(Infinity);
  });
});
