import { z } from "zod";

export const healthViewSchema = z.object({
  status: z.literal("ok")
});

export type HealthView = z.infer<typeof healthViewSchema>;
