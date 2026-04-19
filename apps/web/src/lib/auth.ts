import 'server-only';

import { createBetterAuth, parseAuthEnv } from '@synterra/auth';
import { createDb } from '@synterra/db';

const env = parseAuthEnv(process.env);
const db = createDb(env.DATABASE_URL);

export const auth = createBetterAuth({ db, env });
