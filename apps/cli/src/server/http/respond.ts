import type { ServerResponse } from 'node:http';
import { browserHttpErrorV1 } from '@gitifact/contracts';

export type ErrorCode = 'BAD_REQUEST' | 'FORBIDDEN' | 'NOT_FOUND' | 'METHOD_NOT_ALLOWED' | 'SESSION_CHANGED' | 'SERVER_CLOSING' | 'INTERNAL_ERROR';

/** A refusal a route decides on; the router answers it with the error contract. */
export class HttpError extends Error {
  constructor(readonly status: number, readonly code: ErrorCode, message: string) { super(message); }
}

export function json(response: ServerResponse, status: number, value: unknown) {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  response.end(JSON.stringify(value) + '\n');
}
export function fail(response: ServerResponse, status: number, code: ErrorCode, message: string) {
  json(response, status, browserHttpErrorV1.parse({ contract: 'browser-http-error', version: 1, error: { code, message } }));
}
