import type { Request, Response } from 'express';
import app from '../server.ts';

// Vercel serverless function entrypoint
export default function handler(req: Request, res: Response) {
  return app(req, res);
}
