import { z } from 'zod';

export const userRoleSchema = z.enum(['freshman', 'senior', 'administrator', 'developer']);
export type UserRole = z.infer<typeof userRoleSchema>;

export const accountStatusSchema = z.enum([
  'pending_verification',
  'active',
  'suspended',
  'deactivated',
]);
export type AccountStatus = z.infer<typeof accountStatusSchema>;

export const tokenTypeSchema = z.enum(['email_verification', 'password_reset']);
export type TokenType = z.infer<typeof tokenTypeSchema>;

const handleSchema = z
  .string()
  .min(3, 'Handle must be at least 3 characters')
  .max(32, 'Handle must be at most 32 characters')
  .regex(/^[a-z0-9_]+$/, 'Handle may only contain lowercase letters, numbers, and underscores');

const emailSchema = z
  .string()
  .email('A valid email address is required')
  .max(255, 'Email must be at most 255 characters')
  .transform((value) => value.toLowerCase().trim());

const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(128, 'Password must be at most 128 characters')
  .regex(/[A-Z]/, 'Password must contain an uppercase letter')
  .regex(/[a-z]/, 'Password must contain a lowercase letter')
  .regex(/[0-9]/, 'Password must contain a number');

export const semesterSchema = z
  .number()
  .int('Semester must be a whole number')
  .min(1, 'Semester must be between 1 and 12')
  .max(12, 'Semester must be between 1 and 12');

export const registerBodySchema = z.object({
  handle: handleSchema,
  email: emailSchema,
  password: passwordSchema,
  semester: semesterSchema,
  socialName: z.string().max(60, 'Name must be at most 60 characters').optional(),
});
export type RegisterBody = z.infer<typeof registerBodySchema>;

export const loginBodySchema = z.object({
  identifier: z.string().min(3, 'Nome ou email is required').max(255),
  password: z.string().min(1, 'Password is required').max(128),
});
export type LoginBody = z.infer<typeof loginBodySchema>;

export const recoverBodySchema = z.object({
  email: emailSchema,
});
export type RecoverBody = z.infer<typeof recoverBodySchema>;

export const resetPasswordBodySchema = z.object({
  token: z.string().min(32, 'Token is invalid').max(256),
  password: passwordSchema,
});
export type ResetPasswordBody = z.infer<typeof resetPasswordBodySchema>;

export const verifyEmailParamsSchema = z.object({
  token: z.string().min(32, 'Token is invalid').max(256),
});
export type VerifyEmailParams = z.infer<typeof verifyEmailParamsSchema>;

export const genericSuccessResponseSchema = z.object({
  ok: z.literal(true),
  message: z.string(),
});

export const authUserSchema = z.object({
  id: z.string().uuid(),
  handle: z.string(),
  email: z.string().email(),
  role: userRoleSchema,
  semester: z.number(),
  status: accountStatusSchema,
  socialName: z.string().nullable(),
  createdAt: z.date(),
});
export type AuthUser = z.infer<typeof authUserSchema>;

export const meResponseSchema = z.object({
  user: authUserSchema,
});

export const registerResponseSchema = genericSuccessResponseSchema;
export const loginResponseSchema = z.object({
  user: authUserSchema,
});
export const logoutResponseSchema = genericSuccessResponseSchema;
export const recoverResponseSchema = genericSuccessResponseSchema;
export const resetPasswordResponseSchema = genericSuccessResponseSchema;
export const verifyEmailResponseSchema = genericSuccessResponseSchema;
