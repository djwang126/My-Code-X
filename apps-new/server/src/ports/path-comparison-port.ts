export interface PathComparisonPort {
  samePath(input: SamePathInput): boolean;
}

export interface SamePathInput {
  readonly left: string;
  readonly right: string;
}
