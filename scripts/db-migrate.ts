// Rulare manuala: npm run db:migrate
// Aplica db/schema.sql si, daca baza este goala, db/seed.sql.
import { runMigrations } from '../lib/migrations.ts';

const r = await runMigrations();
console.log(`Schema aplicata in ${r.durataMs} ms.`);
console.log(r.fixturesInserate ? 'Fixtures inserate.' : 'Baza contine deja date - fixtures omise.');
