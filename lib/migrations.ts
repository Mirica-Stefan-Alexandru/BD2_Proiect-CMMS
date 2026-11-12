// Migrare schema + fixtures. Fara importuri "@/..." ca sa poata fi rulat si
// direct cu Node (scripts/db-migrate.ts), nu doar din Next.js.
import { Pool } from '@neondatabase/serverless';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const LOCK_MIGRARE = 727_001; // pg_advisory_xact_lock: o singura instanta migreaza odata

export interface RezultatMigrare {
    durataMs: number;
    fixturesInserate: boolean;
}

export async function runMigrations(
    { cuFixtures = true }: { cuFixtures?: boolean } = {}
): Promise<RezultatMigrare> {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error('DATABASE_URL nu este setat.');

    const start = Date.now();
    const radacina = process.cwd();
    const schema = await readFile(path.join(radacina, 'db', 'schema.sql'), 'utf8');

    const pool = new Pool({ connectionString: url });
    const client = await pool.connect();
    let fixturesInserate = false;

    try {
        await client.query('BEGIN');
        await client.query('SELECT pg_advisory_xact_lock($1)', [LOCK_MIGRARE]);
        await client.query(schema);

        if (cuFixtures) {
            const { rows } = await client.query('SELECT count(*)::int AS n FROM utilizatori');
            if (rows[0].n === 0) {
                const seed = await readFile(path.join(radacina, 'db', 'seed.sql'), 'utf8');
                await client.query(seed);

                // plansa SVG demonstrativa (export EPLAN) pentru CMD-2026-004
                const svg = await readFile(
                    path.join(radacina, 'public', 'demo', 'CMD-2026-004_pagina-01.svg'),
                    'utf8'
                );
                await client.query(
                    `INSERT INTO planse_schema (proiect_id, numar_pagina, titlu_pagina, cale_fisier, continut_svg)
                     SELECT id, 1, 'Circuit forta si comanda pompa', 'CMD-2026-004_pagina-01.svg', $1
                     FROM proiecte WHERE cod_comanda = 'CMD-2026-004'
                     ON CONFLICT (proiect_id, numar_pagina) DO NOTHING`,
                    [svg]
                );
                fixturesInserate = true;
            }
        }

        await client.query('COMMIT');
    } catch (e) {
        await client.query('ROLLBACK').catch(() => {});
        throw e;
    } finally {
        client.release();
        await pool.end();
    }

    return { durataMs: Date.now() - start, fixturesInserate };
}
