export interface ShutdownTarget {
  close(): Promise<void>;
}

export function registerShutdown(target: ShutdownTarget): void {
  void target;
}