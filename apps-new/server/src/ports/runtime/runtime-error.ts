export interface RuntimeErrorInfo {
  readonly message: string;
  readonly code: string | null;
  readonly details?: string | null;
}
