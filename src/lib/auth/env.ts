import { z } from "zod";

const envSchema = z.object({
  DB: z.any(),
  SESSION_SECRET: z.string().min(1),
  CRED_ENC_KEY: z.string().min(1),
  TMDB_ACCESS_TOKEN: z.string().optional().default(""),
  GMAIL_USER: z.string().optional().default(""),
  GMAIL_APP_PASSWORD: z.string().optional().default(""),
});

export type ValidatedEnv = z.infer<typeof envSchema>;

export function getEnv(env: unknown): ValidatedEnv {
  const result = envSchema.safeParse(env);
  if (!result.success) {
    const missing = result.error.issues.map((i) => i.path.join(".")).join(", ");
    throw new Error(`Invalid environment configuration: ${missing}`);
  }
  return result.data;
}
