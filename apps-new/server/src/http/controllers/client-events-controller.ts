import { clientEventScopeSchema, type ClientEventScope } from '@my-code-x/contracts-new';
import type { ClientEventStream } from '../../application/index.js';
import { errorResponse, eventStreamResponse } from '../http-responses.js';
import type { HttpHandler, HttpQuery, HttpRequest, HttpResponse } from '../http-types.js';

export interface ClientEventsControllerInput {
  readonly eventStream: ClientEventStream;
}

export function createClientEventsController(input: ClientEventsControllerInput): HttpHandler {
  return {
    async handle(request: HttpRequest): Promise<HttpResponse> {
      const scope = readClientEventScope(request.query);

      if (!scope) {
        return errorResponse({
          statusCode: 400,
          body: 'Invalid client event scope',
        });
      }

      return eventStreamResponse({
        open(writer) {
          let closed = false;
          const unsubscribe = input.eventStream.subscribe({
            scope,
            send(event) {
              if (closed) {
                return;
              }

              writer.write(formatServerSentEvent({ data: event }));
            },
          });

          return () => {
            closed = true;
            unsubscribe();
          };
        },
      });
    },
  };
}

function readClientEventScope(query: HttpQuery): ClientEventScope | null {
  const slotId = readNullableQueryString(query.slotId);
  const threadId = readNullableQueryString(query.threadId);

  if (slotId.status === 'invalid' || threadId.status === 'invalid') {
    return null;
  }

  const parsed = clientEventScopeSchema.safeParse({
    slotId: slotId.value,
    threadId: threadId.value,
  });

  if (!parsed.success) {
    return null;
  }

  return parsed.data;
}

type ReadNullableQueryStringResult =
  | { readonly status: 'valid'; readonly value: string | null }
  | { readonly status: 'invalid' };

function readNullableQueryString(value: string | readonly string[] | undefined): ReadNullableQueryStringResult {
  if (value === undefined) {
    return {
      status: 'valid',
      value: null,
    };
  }

  if (typeof value === 'string') {
    return {
      status: 'valid',
      value,
    };
  }

  if (value.length === 1) {
    return {
      status: 'valid',
      value: value[0] ?? null,
    };
  }

  return {
    status: 'invalid',
  };
}

interface FormatServerSentEventInput {
  readonly data: unknown;
}

function formatServerSentEvent(input: FormatServerSentEventInput): string {
  return `data: ${JSON.stringify(input.data)}\n\n`;
}

