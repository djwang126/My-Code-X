export interface AppDataStorePort {
  readDocument(input: ReadAppDataDocumentInput): Promise<string | null>;
  writeDocumentAtomically(input: WriteAppDataDocumentInput): Promise<void>;
}

export interface ReadAppDataDocumentInput {
  readonly name: string;
}

export interface WriteAppDataDocumentInput {
  readonly name: string;
  readonly content: string;
}

export type AppDataStoreErrorCode =
  | 'invalid-document-name'
  | 'read-failed'
  | 'write-failed';

export class AppDataStoreError extends Error {
  constructor(
    public readonly code: AppDataStoreErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'AppDataStoreError';
  }
}
