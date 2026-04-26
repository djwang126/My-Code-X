export type RuntimeCommand = unknown;

// RuntimeEvent is produced by an external runtime adapter.
// It is not a domain event and should be interpreted by a feature before publication.
export type RuntimeEvent = unknown;

export type RuntimeResult = unknown;

export type RuntimeEventHandler = (event: RuntimeEvent) => void;
export type Unsubscribe = () => void;

export interface RuntimePort {
  send(input: RuntimeCommand): Promise<RuntimeResult>;
  subscribe(handler: RuntimeEventHandler): Unsubscribe;
  close(): Promise<void>;
}
