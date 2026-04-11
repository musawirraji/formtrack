import { z } from "zod";

/**
 * Zod schemas for every auth form. Kept in their own file so the
 * client (form validation) and server (action validation) both import
 * the same source of truth. Unit tests pin the regexes and bounds.
 */

export const emailSchema = z
  .string()
  .trim()
  .min(1, "Email is required")
  .email("That doesn't look like a valid email")
  .max(254, "Email is too long");

export const passwordSchema = z
  .string()
  .min(10, "Password must be at least 10 characters")
  .max(200, "Password is too long");

export const loginSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
});

export const signupSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  workspaceName: z
    .string()
    .trim()
    .min(1, "Workspace name is required")
    .max(80, "Workspace name is too long"),
});

export const magicLinkSchema = z.object({
  email: emailSchema,
});

export type LoginInput = z.infer<typeof loginSchema>;
export type SignupInput = z.infer<typeof signupSchema>;
export type MagicLinkInput = z.infer<typeof magicLinkSchema>;
