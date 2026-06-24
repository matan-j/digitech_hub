import { register } from 'node:module';
import { pathToFileURL } from 'node:url';
register('./ts-extensionless-hooks.mjs', pathToFileURL('./scripts/'));
