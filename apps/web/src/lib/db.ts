import { createDb } from '@synterra/db';

const connectionString = process.env['DATABASE_URL'];
if (!connectionString) throw new Error('DATABASE_URL env var is not set');

export const db = createDb(connectionString);
