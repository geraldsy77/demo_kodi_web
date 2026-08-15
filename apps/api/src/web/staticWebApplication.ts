import { existsSync } from 'node:fs';
import path from 'node:path';

import express, {
  type Express,
  type NextFunction,
  type Request,
  type Response,
} from 'express';

export function mountStaticWebApplication(app: Express, webDistPath: string): void {
  const indexPath = path.join(webDistPath, 'index.html');
  if (!existsSync(indexPath)) {
    throw new Error('WEB_DIST_PATH must contain a compiled index.html file.');
  }

  app.use(express.static(webDistPath, {
    fallthrough: true,
    index: false,
  }));

  app.get(/^(?!\/api(?:\/|$)).*/, (
    request: Request,
    response: Response,
    next: NextFunction,
  ) => {
    if (!request.accepts('html')) {
      next();
      return;
    }
    response.sendFile(indexPath, (error) => {
      if (error) next(error);
    });
  });
}
