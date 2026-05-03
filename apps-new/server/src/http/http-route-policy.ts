export type HttpRouteKind = 'client' | 'client-events' | 'health' | 'static';

export interface ClassifyHttpRouteInput {
  readonly path: string;
}

export function classifyHttpRoute(input: ClassifyHttpRouteInput): HttpRouteKind {
  switch (input.path) {
    case '/client':
      return 'client';

    case '/client/events':
      return 'client-events';

    case '/health':
      return 'health';

    default:
      return 'static';
  }
}

export function isHttpApplicationRoute(input: ClassifyHttpRouteInput): boolean {
  return classifyHttpRoute(input) !== 'static';
}
