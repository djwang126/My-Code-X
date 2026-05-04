export type PathInspectionResult =
  | PathInspectionAvailableResult
  | PathInspectionInvalidResult;

export interface PathInspectionAvailableResult {
  readonly status: 'available';
  readonly canonicalPath: string;
  readonly basename: string;
}

export interface PathInspectionInvalidResult {
  readonly status: 'invalid';
  readonly reason: PathInspectionInvalidReason;
  readonly message: string;
}

export type PathInspectionInvalidReason =
  | 'empty'
  | 'relative'
  | 'missing'
  | 'not-directory'
  | 'inaccessible'
  | 'canonicalization-failed';

export interface PathInspectionPort {
  inspect(input: InspectPathInput): Promise<PathInspectionResult>;
}

export interface InspectPathInput {
  readonly path: string;
}
