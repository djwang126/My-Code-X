import type { ApiErrorCode, ErrorTarget } from "@my-code-x/app-types";

export interface AppErrorInput {
  code: ApiErrorCode;
  message: string;
  status: number;
  retryable: boolean;
  target?: ErrorTarget;
}

export class AppError extends Error {
  readonly code: ApiErrorCode;
  readonly status: number;
  readonly retryable: boolean;
  readonly target: ErrorTarget | undefined;

  constructor(input: AppErrorInput) {
    super(input.message);
    this.name = "AppError";
    this.code = input.code;
    this.status = input.status;
    this.retryable = input.retryable;
    this.target = input.target;
  }
}
