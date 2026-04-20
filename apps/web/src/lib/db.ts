import { createDb, type Database } from '@synterra/db';

let _instance: Database | undefined;

function getInstance(): Database {
  if (!_instance) {
    const url = process.env['DATABASE_URL'];
    if (!url) throw new Error('DATABASE_URL env var is not set');
    _instance = createDb(url);
  }
  return _instance;
}

// Proxy so call sites (db.select, db.insert, …) work unchanged.
// Lazy init: the connection is created on first property access, not at import
// time — this prevents Next.js build-time module evaluation from failing when
// DATABASE_URL is only available in the runtime container environment.
export const db: Database = new Proxy({} as Database, {
  get(_target, prop, receiver): unknown {
    return Reflect.get(getInstance(), prop, receiver);
  },
});
