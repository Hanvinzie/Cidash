import 'reflect-metadata';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { handler as backendHandler } from '../backend/dist/main.js';

export default async function handler(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  return backendHandler(req, res);
}
