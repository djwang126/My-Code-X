import type { JsonValue } from '../shared/index.js';

export type PendingInteractionLifecycle = 'open' | 'submitting' | 'resolved' | 'expired';

export type PendingInteractionControl =
  | PendingInteractionButtonControl
  | PendingInteractionInputControl
  | PendingInteractionChoiceControl;

export interface PendingInteractionButtonControl {
  readonly kind: 'button';
  readonly id: string;
  readonly label: string;
  readonly style: 'primary' | 'normal' | 'danger';
}

export interface PendingInteractionInputControl {
  readonly kind: 'input';
  readonly id: string;
  readonly label: string;
  readonly secret: boolean;
}

export interface PendingInteractionChoiceControl {
  readonly kind: 'choice';
  readonly id: string;
  readonly label: string;
  readonly choices: readonly PendingInteractionChoice[];
}

export interface PendingInteractionChoice {
  readonly id: string;
  readonly label: string;
  readonly description: string;
}

export type PendingInteractionResponseShape =
  | { readonly kind: 'decision' }
  | { readonly kind: 'form' }
  | { readonly kind: 'freeform' }
  | { readonly kind: 'structured'; readonly schema: JsonValue };

export interface PendingInteractionBase {
  readonly id: string;
  readonly lifecycle: PendingInteractionLifecycle;
  readonly title: string;
  readonly body: string;
  readonly controls: readonly PendingInteractionControl[];
  readonly responseShape: PendingInteractionResponseShape;
}

export type PendingInteraction =
  | ApprovalInteraction
  | FormInteraction
  | AuthInteraction
  | ToolResponseInteraction;

export interface ApprovalInteraction extends PendingInteractionBase {
  readonly kind: 'approval';
}

export interface FormInteraction extends PendingInteractionBase {
  readonly kind: 'form';
}

export interface AuthInteraction extends PendingInteractionBase {
  readonly kind: 'auth';
}

export interface ToolResponseInteraction extends PendingInteractionBase {
  readonly kind: 'tool-response';
}
