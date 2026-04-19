import 'server-only';

import { createDb } from '@synterra/db';
import { createBetterAuth, parseAuthEnv } from '@synterra/auth';

const env = parseAuthEnv(process.env);
const db = createDb(env.DATABASE_URL);

export const auth = createBetterAuth({ db, env });
