export type HttpRouteKind = 'client' | 'health' | 'static';

export interface ClassifyHttpRouteInput {
  readonly path: string;
}

export function classifyHttpRoute(input: ClassifyHttpRouteInput): HttpRouteKind {
  switch (input.path) {
    case '/client':
      return 'client';

    case '/health':
      return 'health';

    default:
      return 'static';
  }
}

export function isHttpApplicationRoute(input: ClassifyHttpRouteInput): boolean {
  return classifyHttpRoute(input) !== 'static';
}
