import type {
  AgentCliDomainEvent,
  AuthoritativeSnapshot,
  CliKind,
  RecoveredSnapshot
} from "@my-code-x/app-types";

export interface TranslateNativeInput {
  raw: unknown;
}

export interface NativeTranslator {
  readonly cliKind: CliKind;

  translateRecoveredHistory(input: TranslateNativeInput): RecoveredSnapshot;
  translateAuthoritativeState(input: TranslateNativeInput): AuthoritativeSnapshot;
  translateLiveRecord(input: TranslateNativeInput): AgentCliDomainEvent[];
}
