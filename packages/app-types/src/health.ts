import { z } from "zod";
import { apiResponseSchema } from "./api-response";

export const healthViewSchema = z.object({
  status: z.literal("ok")
});

export type HealthView = z.infer<typeof healthViewSchema>;

export const healthViewResponseSchema = apiResponseSchema(healthViewSchema);
