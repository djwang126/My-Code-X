import { z } from "zod";

export const apiErrorCodeSchema = z.enum(["INTERNAL_ERROR"]);

export type ApiErrorCode = z.infer<typeof apiErrorCodeSchema>;

export const errorTargetSchema = z.object({
  field: z.string().optional()
});

export type ErrorTarget = z.infer<typeof errorTargetSchema>;

export const apiErrorSchema = z.object({
  code: apiErrorCodeSchema,
  message: z.string(),
  retryable: z.boolean(),
  target: errorTargetSchema.optional()
});

export type ApiError = z.infer<typeof apiErrorSchema>;

export type ApiSuccess<T> = {
  ok: true;
  data: T;
};

export type ApiFailure = {
  ok: false;
  error: ApiError;
};

export type ApiResponse<T> = ApiSuccess<T> | ApiFailure;

export function apiResponseSchema<T extends z.ZodType>(dataSchema: T) {
  return z.discriminatedUnion("ok", [
    z.object({
      ok: z.literal(true),
      data: dataSchema
    }),
    z.object({
      ok: z.literal(false),
      error: apiErrorSchema
    })
  ]);
}
