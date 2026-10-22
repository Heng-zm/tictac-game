import { z } from 'zod';

export const SIDE_VALUES = ['X', 'O'] as const;
export const DIFFICULTY_VALUES = ['EASY', 'MEDIUM', 'HARD'] as const;

const uuidSchema = z.string().uuid();
const displayNameSchema = z
  .string()
  .trim()
  .min(1)
  .max(64)
  .regex(/^[^\p{Cc}\p{Cf}]+$/u, 'Display name contains unsupported characters');

const inviteTokenSchema = z
  .string()
  .regex(/^[A-Za-z0-9_-]{43}$/, 'Malformed invitation token');

export const queueJoinSchema = z
  .object({
    autoAiFallback: z.boolean().optional(),
  })
  .strict();

export const aiStartSchema = z
  .object({
    difficulty: z.enum(DIFFICULTY_VALUES),
    side: z.enum(SIDE_VALUES),
  })
  .strict();

export const matchJoinSchema = z.object({ matchId: uuidSchema }).strict();

export const moveSubmitSchema = z
  .object({
    matchId: uuidSchema,
    cell: z.number().int(),
    actionId: uuidSchema,
  })
  .strict();

export const inviteAcceptSchema = z.object({ token: inviteTokenSchema }).strict();

export const inviteCancelSchema = z.object({ invitationId: uuidSchema }).strict();

export const matchIdOnlySchema = z.object({ matchId: uuidSchema }).strict();

export const telegramInitDataSchema = z
  .object({
    initData: z.string().min(1).max(8192),
  })
  .strict();

export const devAuthSchema = z
  .object({
    deviceKey: z.string().min(8).max(128),
    displayName: displayNameSchema.optional(),
  })
  .strict();

export const preferencesSchema = z
  .object({
    autoAiFallback: z.boolean().optional(),
    turnNotifications: z.boolean().optional(),
  })
  .strict()
  .refine((value) => value.autoAiFallback !== undefined || value.turnNotifications !== undefined, {
    message: 'At least one preference is required',
  });

export const historyQuerySchema = z
  .object({
    limit: z.coerce.number().int().min(1).max(50).default(10),
    cursor: uuidSchema.optional(),
  })
  .strict();

export const leaderboardQuerySchema = z
  .object({
    limit: z.coerce.number().int().min(1).max(50).default(20),
  })
  .strict();

export const invitationTokenParamSchema = z.object({
  token: inviteTokenSchema,
});

const emptyToNull = (val: unknown) => (typeof val === 'string' && val.trim() === '' ? null : val);

export const telegramWebAppUserSchema = z
  .object({
    id: z.number().int().positive().safe(),
    first_name: z.string().min(1).max(128),
    last_name: z.preprocess(emptyToNull, z.string().max(128).optional().nullable()),
    username: z.preprocess(
      emptyToNull,
      z
        .string()
        .max(64)
        .regex(/^[A-Za-z0-9_]+$/)
        .optional()
        .nullable(),
    ),
    language_code: z.preprocess(emptyToNull, z.string().max(16).optional().nullable()),
    photo_url: z.preprocess(
      emptyToNull,
      z
        .string()
        .max(1024)
        .url()
        .refine((value) => value.startsWith('https://'), 'Profile photo must use HTTPS')
        .optional()
        .nullable(),
    ),
    is_bot: z.boolean().optional().nullable(),
    is_premium: z.boolean().optional().nullable(),
  })
  .passthrough();

export type MoveSubmitInput = z.infer<typeof moveSubmitSchema>;
export type AiStartInput = z.infer<typeof aiStartSchema>;
export type TelegramWebAppUserInput = z.infer<typeof telegramWebAppUserSchema>;

export function normalizeDisplayName(input: string | undefined, fallback = 'Player'): string {
  const cleaned = (input ?? '')
    .replace(/[\p{Cc}\p{Cf}]/gu, '')
    .trim()
    .slice(0, 64);
  return cleaned || fallback;
}
