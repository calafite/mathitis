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
  .min(3, 'O nome de usuário deve ter pelo menos 3 caracteres')
  .max(32, 'O nome de usuário deve ter no máximo 32 caracteres')
  .regex(
    /^[a-z0-9_]+$/,
    'O nome de usuário pode conter apenas letras minúsculas, números e underscores',
  );

const emailSchema = z
  .string()
  .email('Informe um endereço de e-mail válido')
  .max(255, 'O e-mail deve ter no máximo 255 caracteres')
  .transform((value) => value.toLowerCase().trim());

const passwordSchema = z
  .string()
  .min(8, 'A senha deve ter pelo menos 8 caracteres')
  .max(128, 'A senha deve ter no máximo 128 caracteres')
  .regex(/[A-Z]/, 'A senha deve conter uma letra maiúscula')
  .regex(/[a-z]/, 'A senha deve conter uma letra minúscula')
  .regex(/[0-9]/, 'A senha deve conter um dígito numérico');

export const semesterSchema = z
  .number()
  .int('O período deve ser um número inteiro')
  .min(1, 'O período deve estar entre 1 e 12')
  .max(12, 'O período deve estar entre 1 e 12');

export const registerBodySchema = z.object({
  handle: handleSchema,
  email: emailSchema,
  password: passwordSchema,
  semester: semesterSchema,
  socialName: z.string().max(60, 'O nome deve ter no máximo 60 caracteres').optional(),
});
export type RegisterBody = z.infer<typeof registerBodySchema>;

export const loginBodySchema = z.object({
  identifier: z.string().min(3, 'Informe o nome de usuário ou e-mail').max(255),
  password: z.string().min(1, 'Informe a senha').max(128),
});
export type LoginBody = z.infer<typeof loginBodySchema>;

export const recoverBodySchema = z.object({
  email: emailSchema,
});
export type RecoverBody = z.infer<typeof recoverBodySchema>;

export const resetPasswordBodySchema = z.object({
  token: z.string().min(32, 'Token inválido').max(256),
  password: passwordSchema,
});
export type ResetPasswordBody = z.infer<typeof resetPasswordBodySchema>;

export const verifyEmailParamsSchema = z.object({
  token: z.string().min(32, 'Token inválido').max(256),
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
  preferences: z
    .object({
      onboarded: z.boolean().optional(),
    })
    .nullable()
    .optional(),
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
