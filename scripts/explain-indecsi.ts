// Justificarea indecsilor prin planuri de executie (inainte / dupa).
// Rulare: npm run db:explain   ->  scrie docs/indecsi-explain.md
//
// Totul ruleaza intr-o SINGURA TRANZACTIE terminata cu ROLLBACK:
//   1. genereaza un volum realist de date sintetice (mii de proiecte, zeci de mii de randuri)
//   2. pentru fiecare index: DROP INDEX -> EXPLAIN ANALYZE -> CREATE INDEX -> EXPLAIN ANALYZE
//   3. ROLLBACK - baza de date ramane exact cum era (nici datele, nici indecsii nu se schimba)
import { Pool } from '@neondatabase/serverless';
import { mkdirSync, writeFileSync } from 'node:fs';

const VOLUM = { utilizatori: 300, proiecte: 5000, componentePeProiect: 10, repere: 5, testePeReper: 3, jurnal: 100000 };

interface Caz {
    index: string;
    creare: string;
    scop: string;
    interogare: string;
}

const CAZURI: Caz[] = [
    {
        index: 'idx_asignari_utilizator',
        creare: 'CREATE INDEX idx_asignari_utilizator ON asignari_proiect (utilizator_id)',
        scop: 'Dashboard inginer/operator si overview echipa: proiectele unui angajat (asignari dupa utilizator).',
        interogare: `SELECT a.proiect_id, a.rol_in_proiect FROM asignari_proiect a WHERE a.utilizator_id = $U`,
    },
    {
        index: 'idx_proiecte_status_termen',
        creare: 'CREATE INDEX idx_proiecte_status_termen ON proiecte (status, termen_limita)',
        scop: 'Filtrarea dashboard-ului dupa status, ordonata dupa termenul limita.',
        interogare: `SELECT id, cod_comanda, termen_limita FROM proiecte
                     WHERE status = 'TESTARE_RECE' ORDER BY termen_limita LIMIT 50`,
    },
    {
        index: 'idx_componente_verificat_de',
        creare: 'CREATE INDEX idx_componente_verificat_de ON componente_proiect (verificat_de, verificat_la) WHERE verificat_de IS NOT NULL',
        scop: 'Performanta angajat: cate componente a bifat in ultimele 30 de zile (index partial).',
        interogare: `SELECT count(*) FROM componente_proiect
                     WHERE verificat_de = $U AND verificat AND verificat_la > NOW() - INTERVAL '30 days'`,
    },
    {
        index: 'idx_verificari_componenta_data',
        creare: 'CREATE INDEX idx_verificari_componenta_data ON verificari_componente (componenta_id, data_verificare DESC)',
        scop: 'Ultimul test al unei componente (vizualizator SVG, fisa de receptie).',
        interogare: `SELECT status_test FROM verificari_componente
                     WHERE componenta_id = $C ORDER BY data_verificare DESC LIMIT 1`,
    },
    {
        index: 'idx_verificari_utilizator',
        creare: 'CREATE INDEX idx_verificari_utilizator ON verificari_componente (verificat_de_id, data_verificare DESC)',
        scop: 'Performanta inginer: teste semnate (total si ultimele 30 de zile).',
        interogare: `SELECT count(*) FILTER (WHERE data_verificare > NOW() - INTERVAL '30 days')
                     FROM verificari_componente WHERE verificat_de_id = $U`,
    },
    {
        index: 'idx_jurnal_utilizator_data',
        creare: 'CREATE INDEX idx_jurnal_utilizator_data ON jurnal_activitate (utilizator_id, creat_la DESC)',
        scop: 'Profil angajat: ultimele 20 de actiuni din jurnal.',
        interogare: `SELECT actiune, detalii, creat_la FROM jurnal_activitate
                     WHERE utilizator_id = $U ORDER BY creat_la DESC LIMIT 20`,
    },
    {
        index: 'idx_jurnal_proiect_data',
        creare: 'CREATE INDEX idx_jurnal_proiect_data ON jurnal_activitate (proiect_id, creat_la DESC)',
        scop: 'Pagina proiectului: jurnalul proiectului.',
        interogare: `SELECT actiune, creat_la FROM jurnal_activitate
                     WHERE proiect_id = $P ORDER BY creat_la DESC LIMIT 30`,
    },
];

function rezumat(plan: string): { timp: number; nod: string } {
    const timp = Number(/Execution Time: ([\d.]+)/.exec(plan)?.[1] ?? NaN);
    const nod = (/(Index Only Scan|Index Scan|Bitmap Index Scan|Bitmap Heap Scan|Seq Scan|Parallel Seq Scan)/.exec(plan)?.[1]) ?? '?';
    return { timp, nod };
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const c = await pool.connect();
const sectiuni: string[] = [];
const tabel: string[] = [];

try {
    await c.query('BEGIN');
    console.log('Generez date sintetice (in tranzactie)...');
    const t0 = Date.now();
    await c.query(`
        INSERT INTO utilizatori (nume, email, parola_hash, rol)
        SELECT 'Sintetic ' || g, 'sintetic' || g || '@explain.local', 'x', (ARRAY['OPERATOR','INGINER'])[1 + g % 2]
        FROM generate_series(1, ${VOLUM.utilizatori}) g;

        CREATE TEMP TABLE u_sint ON COMMIT DROP AS
        SELECT id, row_number() OVER (ORDER BY id) AS nr FROM utilizatori WHERE email LIKE '%@explain.local';
        ALTER TABLE u_sint ADD PRIMARY KEY (nr);

        INSERT INTO proiecte (cod_comanda, titlu, status, creat_de_id, termen_limita)
        SELECT 'SYN-' || g, 'Proiect sintetic ' || g,
               (ARRAY['PLANIFICAT','IN_LUCRU','TESTARE_RECE','FINALIZAT'])[1 + g % 4],
               (SELECT id FROM u_sint WHERE nr = 1 + g % ${VOLUM.utilizatori}), CURRENT_DATE + (g % 365)
        FROM generate_series(1, ${VOLUM.proiecte}) g;

        CREATE TEMP TABLE p_sint ON COMMIT DROP AS
        SELECT id, row_number() OVER (ORDER BY id) AS nr FROM proiecte WHERE cod_comanda LIKE 'SYN-%';
        ALTER TABLE p_sint ADD PRIMARY KEY (nr);
        ANALYZE u_sint;
        ANALYZE p_sint;

        INSERT INTO asignari_proiect (proiect_id, utilizator_id, rol_in_proiect)
        SELECT p.id, u.id, 'EXECUTANT_TABLOU'
        FROM p_sint p CROSS JOIN generate_series(0, 2) k
        JOIN u_sint u ON u.nr = 1 + (p.nr * 7 + k * 101) % ${VOLUM.utilizatori}
        ON CONFLICT DO NOTHING;

        INSERT INTO componente_proiect (proiect_id, cod_reper, descriere, cantitate, verificat, verificat_de, verificat_la)
        SELECT p.id, '-K' || k, 'Componenta sintetica', 1, k % 2 = 0,
               CASE WHEN k % 2 = 0 THEN (SELECT id FROM u_sint WHERE nr = 1 + (p.nr + k) % ${VOLUM.utilizatori}) END,
               CASE WHEN k % 2 = 0 THEN NOW() - ((p.nr % 90) || ' days')::interval END
        FROM p_sint p CROSS JOIN generate_series(1, ${VOLUM.componentePeProiect}) k;

        INSERT INTO planse_schema (proiect_id, numar_pagina, titlu_pagina, cale_fisier)
        SELECT id, 1, 'Pagina sintetica', 'syn.svg' FROM p_sint;

        INSERT INTO componente_schema (plansa_id, tag_echipament, descriere_tip, pos_x, pos_y, latime, inaltime)
        SELECT ps.id, '-Q' || k, 'Reper sintetic', k * 10, k * 10, 5, 5
        FROM planse_schema ps JOIN p_sint p ON p.id = ps.proiect_id CROSS JOIN generate_series(1, ${VOLUM.repere}) k;

        INSERT INTO verificari_componente (componenta_id, verificat_de_id, status_test, data_verificare)
        SELECT cs.id, (SELECT id FROM u_sint WHERE nr = 1 + (cs.id + k) % ${VOLUM.utilizatori}),
               (ARRAY['VERDE','GALBEN','ROSU','NEGRU'])[1 + (cs.id + k) % 4], NOW() - (k || ' days')::interval
        FROM componente_schema cs JOIN planse_schema ps ON ps.id = cs.plansa_id JOIN p_sint p ON p.id = ps.proiect_id
        CROSS JOIN generate_series(1, ${VOLUM.testePeReper}) k;

        INSERT INTO jurnal_activitate (utilizator_id, proiect_id, actiune, creat_la)
        SELECT (SELECT id FROM u_sint WHERE nr = 1 + g % ${VOLUM.utilizatori}),
               (SELECT id FROM p_sint WHERE nr = 1 + g % ${VOLUM.proiecte}),
               'COMPONENTA_VERIFICATA', NOW() - ((g % 1000) || ' hours')::interval
        FROM generate_series(1, ${VOLUM.jurnal}) g;

        ANALYZE utilizatori, proiecte, asignari_proiect, componente_proiect, planse_schema,
                componente_schema, verificari_componente, jurnal_activitate;
    `);
    const { rows: nr } = await c.query(`
        SELECT (SELECT count(*) FROM proiecte)::int AS proiecte, (SELECT count(*) FROM asignari_proiect)::int AS asignari,
               (SELECT count(*) FROM componente_proiect)::int AS componente, (SELECT count(*) FROM verificari_componente)::int AS teste,
               (SELECT count(*) FROM jurnal_activitate)::int AS jurnal`);
    console.log(`Date generate in ${Date.now() - t0} ms:`, nr[0]);

    // valori reprezentative pentru parametri
    const { rows: v } = await c.query(`
        SELECT (SELECT id FROM utilizatori WHERE email LIKE '%@explain.local' ORDER BY id LIMIT 1 OFFSET 42) AS u,
               (SELECT id FROM proiecte WHERE cod_comanda = 'SYN-1234') AS p,
               (SELECT cs.id FROM componente_schema cs ORDER BY cs.id DESC LIMIT 1 OFFSET 777) AS c`);
    const param = (q: string) => q.replace(/\$U/g, String(v[0].u)).replace(/\$P/g, String(v[0].p)).replace(/\$C/g, String(v[0].c));

    for (const caz of CAZURI) {
        const q = param(caz.interogare);
        const explain = async () => {
            // rulam de 2 ori si pastram a doua masuratoare (cache cald)
            await c.query(`EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT) ${q}`);
            const { rows } = await c.query(`EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT) ${q}`);
            return rows.map((r) => r['QUERY PLAN']).join('\n');
        };

        await c.query(`SAVEPOINT s`);
        await c.query(`DROP INDEX IF EXISTS ${caz.index}`);
        const inainte = await explain();
        await c.query(caz.creare);
        await c.query('ANALYZE');
        const dupa = await explain();
        await c.query(`RELEASE SAVEPOINT s`);

        const a = rezumat(inainte);
        const d = rezumat(dupa);
        const castig = a.timp && d.timp ? `${(a.timp / d.timp).toFixed(1)}x` : '-';
        tabel.push(`| \`${caz.index}\` | ${a.nod} | ${a.timp.toFixed(3)} ms | ${d.nod} | ${d.timp.toFixed(3)} ms | **${castig}** |`);
        sectiuni.push(
            `### ${caz.index}\n\n${caz.scop}\n\n\`\`\`sql\n${caz.creare};\n\`\`\`\n\nInterogare:\n\n\`\`\`sql\n${q.replace(/\s+/g, ' ').trim()}\n\`\`\`\n\n` +
                `**Inainte (fara index)**\n\n\`\`\`\n${inainte}\n\`\`\`\n\n**Dupa (cu index)**\n\n\`\`\`\n${dupa}\n\`\`\`\n`
        );
        console.log(`${caz.index.padEnd(32)} ${a.nod.padEnd(18)} ${a.timp.toFixed(2).padStart(8)} ms  ->  ${d.nod.padEnd(18)} ${d.timp.toFixed(2).padStart(8)} ms  (${castig})`);
    }

    const md = [
        '# Indecsi - justificare prin planuri de executie',
        '',
        `Generat automat de \`npm run db:explain\` la ${new Date().toLocaleString('ro-RO')}.`,
        '',
        'Metoda: intr-o tranzactie anulata la final (ROLLBACK) se genereaza un volum realist de date, apoi pentru fiecare index',
        'se masoara interogarea reala din aplicatie cu `EXPLAIN (ANALYZE, BUFFERS)` fara index si cu index. Baza de date nu este modificata.',
        '',
        `Volum de test: ${JSON.stringify(nr[0])}`,
        '',
        '| Index | Plan fara index | Timp | Plan cu index | Timp | Castig |',
        '|---|---|---|---|---|---|',
        ...tabel,
        '',
        'Observatie: PostgreSQL nu indexeaza automat cheile straine. Coloanele `proiect_id` din asignari / BOM / planse si',
        '`plansa_id` din componente_schema sunt deja acoperite de constrangerile UNIQUE compuse (coloana de start), deci nu au',
        'nevoie de index separat.',
        '',
        ...sectiuni,
    ].join('\n');
    mkdirSync('docs', { recursive: true });
    writeFileSync('docs/indecsi-explain.md', md);
    console.log('\nRaport scris in docs/indecsi-explain.md');
} finally {
    await c.query('ROLLBACK');
    c.release();
    await pool.end();
    console.log('ROLLBACK efectuat - baza de date este neschimbata.');
}
