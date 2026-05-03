import type { RuntimeCommand } from './runtime-command.js';
import type { RuntimeEvent } from './runtime-event.js';
import type { RuntimeResult } from './runtime-result.js';

export type RuntimeEventHandler = (event: RuntimeEvent) => void;
export type Unsubscribe = () => void;

export interface RuntimePort {
  send(input: RuntimeCommand): Promise<RuntimeResult>;
  subscribe(handler: RuntimeEventHandler): Unsubscribe;
  close(): Promise<void>;
}
