import 'reflect-metadata';
import { handler as backendHandler } from '../backend/dist/serverless.mjs';

export default async function handler(req, res) {
  return backendHandler(req, res);
}
