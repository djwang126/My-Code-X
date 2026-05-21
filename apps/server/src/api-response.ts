import type { ApiFailure, ApiResponse } from "@my-code-x/app-types";
import { AppError } from "./app-error";

export function ok<T>(data: T): ApiResponse<T> {
  return {
    ok: true,
    data
  };
}

export function failureFromError(error: unknown): {
  status: number;
  body: ApiFailure;
} {
  if (error instanceof AppError) {
    return {
      status: error.status,
      body: {
        ok: false,
        error: {
          code: error.code,
          message: error.message,
          retryable: error.retryable,
          ...(error.target ? { target: error.target } : {})
        }
      }
    };
  }

  return {
    status: 500,
    body: {
      ok: false,
      error: {
        code: "INTERNAL_ERROR",
        message: "Internal server error",
        retryable: true
      }
    }
  };
}
