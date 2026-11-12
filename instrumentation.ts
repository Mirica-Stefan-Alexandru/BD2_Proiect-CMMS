// Rulat o singura data la pornirea serverului Next.js (inainte de primul request).
// Aplica schema bazei de date (idempotent) si insereaza fixtures pe o baza goala.
// Dezactivare: DB_AUTO_MIGRATE=false

export async function register() {
    if (process.env.NEXT_RUNTIME !== 'nodejs') return;
    if (process.env.NEXT_PHASE === 'phase-production-build') return;
    if (process.env.DB_AUTO_MIGRATE === 'false') return;

    const { runMigrations } = await import('./lib/migrations');
    try {
        const r = await runMigrations();
        console.log(
            `[db] schema verificata in ${r.durataMs} ms` +
                (r.fixturesInserate ? ' - fixtures inserate (baza era goala)' : '')
        );
    } catch (e) {
        console.error('[db] migrarea automata a esuat:', e);
    }
}
