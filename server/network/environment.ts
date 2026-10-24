import { existsSync } from 'node:fs';
import path from 'node:path';
import { loadEnvFile } from 'node:process';
import { parseNetworkConfiguration } from './configuration.ts';

const environmentFile = path.resolve(import.meta.dirname, '../../.env');
if (existsSync(environmentFile)) loadEnvFile(environmentFile);
export const network = parseNetworkConfiguration(process.env);
