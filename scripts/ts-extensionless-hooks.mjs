// Resolver hook: lets extensionless relative imports (./foo) resolve to ./foo.ts
// so the project's TypeScript sources run under `node --experimental-strip-types`.
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export async function resolve(specifier, context, next) {
  if ((specifier.startsWith('./') || specifier.startsWith('../')) && !/\.[a-zA-Z0-9]+$/.test(specifier)) {
    try {
      const candidate = new URL(specifier + '.ts', context.parentURL);
      if (existsSync(fileURLToPath(candidate))) return next(specifier + '.ts', context);
    } catch { /* fall through */ }
  }
  return next(specifier, context);
}
