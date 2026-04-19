/**
 * Synterra Workers — structured logger.
 *
 * Development: pretty-printed via `pino-pretty` (colorized, human-readable).
 * Production / test: JSON on stdout, ready for log aggregators.
 *
 * Secrets and credential-bearing fields are redacted at the pino layer so
 * downstream transports never see them.
 */
import pino, { type DestinationStream, type Logger, type LoggerOptions } from 'pino';

import { otelMixin } from '@synterra/telemetry';

import { env } from './config.js';

const REDACT_PATHS = [
  'req.headers.authorization',
  'req.headers.cookie',
  '*.password',
  '*.apiKey',
  '*.secret',
  '*.token',
];

export function createLogger(): Logger {
  const base = {
    service: '@synterra/workers',
    version: process.env['npm_package_version'] ?? '0.0.0',
  };

  const options: LoggerOptions = {
    level: env.LOG_LEVEL,
    base,
    mixin: otelMixin,
    redact: { paths: REDACT_PATHS, censor: '[REDACTED]' },
    timestamp: pino.stdTimeFunctions.isoTime,
  };

  if (env.NODE_ENV === 'development') {
    // pino.transport() is typed as `ThreadStream` in pino v9 but the runtime
    // return satisfies DestinationStream. Cast at the single point of contact
    // to avoid leaking `any` into the rest of the logger.
    const transport = pino.transport({
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'SYS:HH:MM:ss.l',
        ignore: 'pid,hostname',
      },
    }) as unknown as DestinationStream;
    return pino(options, transport);
  }

  return pino(options);
}

const logger = createLogger();

export default logger;
