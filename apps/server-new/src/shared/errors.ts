export class BoundaryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BoundaryError';
  }
}

export class SkeletonMigrationPendingError extends Error {
  constructor(scope: string) {
    super(`${scope} is a skeleton boundary. Migrate the real feature behavior before using it.`);
    this.name = 'SkeletonMigrationPendingError';
  }
}
