-- =============================================================================
-- CMMS Industrial - Schema bazei de date (PostgreSQL / Neon)
-- -----------------------------------------------------------------------------
-- Fisierul este IDEMPOTENT: poate fi rulat de oricate ori, atat pe o baza goala
-- cat si pe baza existenta. Nu sterge si nu modifica date, doar adauga tabele,
-- coloane, constrangeri si indecsi care lipsesc.
-- Este rulat automat la pornirea serverului (instrumentation.ts) si manual cu
--   npm run db:migrate
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. DEPARTAMENTE
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS departamente (
    id               SERIAL PRIMARY KEY,
    cod_departament  VARCHAR(20)  NOT NULL UNIQUE,
    denumire         VARCHAR(120) NOT NULL,
    creat_la         TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- -----------------------------------------------------------------------------
-- 2. UTILIZATORI (roluri: MANAGER, INGINER, OPERATOR)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS utilizatori (
    id              SERIAL PRIMARY KEY,
    nume            VARCHAR(120) NOT NULL,
    email           VARCHAR(160) NOT NULL UNIQUE,
    parola_hash     VARCHAR(255) NOT NULL,
    rol             VARCHAR(20)  NOT NULL
                    CHECK (rol IN ('OPERATOR', 'INGINER', 'MANAGER')),
    departament_id  INTEGER REFERENCES departamente(id) ON DELETE SET NULL,
    activ           BOOLEAN DEFAULT TRUE,
    creat_la        TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- -----------------------------------------------------------------------------
-- 3. PROIECTE (comenzi de tablouri electrice)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS proiecte (
    id             SERIAL PRIMARY KEY,
    cod_comanda    VARCHAR(40)  NOT NULL UNIQUE,
    titlu          VARCHAR(200) NOT NULL,
    status         VARCHAR(20)  NOT NULL DEFAULT 'IN_LUCRU'
                   CHECK (status IN ('PLANIFICAT', 'IN_LUCRU', 'TESTARE_RECE', 'FINALIZAT')),
    creat_de_id    INTEGER NOT NULL REFERENCES utilizatori(id) ON DELETE RESTRICT,
    termen_limita  DATE NOT NULL,
    creat_la       TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE proiecte ADD COLUMN IF NOT EXISTS descriere    TEXT;
ALTER TABLE proiecte ADD COLUMN IF NOT EXISTS finalizat_la TIMESTAMPTZ;

-- -----------------------------------------------------------------------------
-- 4. ASIGNARI PROIECT (cine lucreaza la ce tablou si cu ce rol)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS asignari_proiect (
    id              SERIAL PRIMARY KEY,
    proiect_id      INTEGER REFERENCES proiecte(id)    ON DELETE CASCADE,
    utilizator_id   INTEGER REFERENCES utilizatori(id) ON DELETE CASCADE,
    rol_in_proiect  VARCHAR(40) NOT NULL,
    creat_la        TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE asignari_proiect ADD COLUMN IF NOT EXISTS asignat_de INTEGER
    REFERENCES utilizatori(id) ON DELETE SET NULL;
ALTER TABLE asignari_proiect ALTER COLUMN proiect_id    SET NOT NULL;
ALTER TABLE asignari_proiect ALTER COLUMN utilizator_id SET NOT NULL;

DO $$
BEGIN
    -- un angajat apare o singura data in echipa unui proiect
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uq_asignare_proiect_utilizator' AND conrelid = 'asignari_proiect'::regclass) THEN
        ALTER TABLE asignari_proiect
            ADD CONSTRAINT uq_asignare_proiect_utilizator UNIQUE (proiect_id, utilizator_id);
    END IF;
    -- rolurile din santier sunt o lista inchisa
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_asignare_rol_in_proiect' AND conrelid = 'asignari_proiect'::regclass) THEN
        ALTER TABLE asignari_proiect
            ADD CONSTRAINT ck_asignare_rol_in_proiect CHECK (rol_in_proiect IN (
                'MANAGER_PROIECT', 'PROIECTANT_ELECTRIC', 'INGINER_AUTOMATIST',
                'RESPONSABIL_TESTARE', 'EXECUTANT_TABLOU', 'CABLARE_SI_MONTAJ'));
    END IF;
END $$;

-- -----------------------------------------------------------------------------
-- 5. COMPONENTE PROIECT (BOM importat din EPLAN - checklist de montaj / QC)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS componente_proiect (
    id            SERIAL PRIMARY KEY,
    proiect_id    INTEGER REFERENCES proiecte(id) ON DELETE CASCADE,
    cod_reper     VARCHAR(60) NOT NULL,
    descriere     TEXT NOT NULL,
    producator    VARCHAR(120),
    cantitate     INTEGER DEFAULT 1,
    verificat     BOOLEAN DEFAULT FALSE,
    verificat_de  INTEGER REFERENCES utilizatori(id) ON DELETE SET NULL,
    observatii    TEXT,
    creat_la      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE componente_proiect ADD COLUMN IF NOT EXISTS verificat_la TIMESTAMPTZ;

DO $$
BEGIN
    -- un reper (ex: -KM1) apare o singura data in BOM-ul unui proiect;
    -- permite si importul CSV de tip UPSERT (ON CONFLICT)
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uq_componenta_proiect_reper' AND conrelid = 'componente_proiect'::regclass) THEN
        ALTER TABLE componente_proiect
            ADD CONSTRAINT uq_componenta_proiect_reper UNIQUE (proiect_id, cod_reper);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_componenta_cantitate' AND conrelid = 'componente_proiect'::regclass) THEN
        ALTER TABLE componente_proiect
            ADD CONSTRAINT ck_componenta_cantitate CHECK (cantitate IS NULL OR cantitate > 0);
    END IF;
END $$;

-- -----------------------------------------------------------------------------
-- 6. PLANSE SCHEMA (paginile schemei electrice exportate din EPLAN)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS planse_schema (
    id            SERIAL PRIMARY KEY,
    proiect_id    INTEGER NOT NULL REFERENCES proiecte(id) ON DELETE CASCADE,
    numar_pagina  INTEGER NOT NULL CHECK (numar_pagina > 0),
    titlu_pagina  VARCHAR(200) NOT NULL,
    cale_fisier   VARCHAR(300) NOT NULL,
    creat_la      TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_proiect_pagina UNIQUE (proiect_id, numar_pagina)
);

-- continutul SVG exportat din EPLAN (vectorial, se cauta etichetele in browser)
ALTER TABLE planse_schema ADD COLUMN IF NOT EXISTS continut_svg TEXT;

-- -----------------------------------------------------------------------------
-- 7. COMPONENTE SCHEMA (pozitia unui echipament pe plansa, in procente 0-100)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS componente_schema (
    id              SERIAL PRIMARY KEY,
    plansa_id       INTEGER NOT NULL REFERENCES planse_schema(id) ON DELETE CASCADE,
    tag_echipament  VARCHAR(60)  NOT NULL,
    descriere_tip   VARCHAR(200) NOT NULL,
    pos_x           NUMERIC NOT NULL CHECK (pos_x >= 0 AND pos_x <= 100),
    pos_y           NUMERIC NOT NULL CHECK (pos_y >= 0 AND pos_y <= 100),
    latime          NUMERIC NOT NULL CHECK (latime > 0 AND latime <= 100),
    inaltime        NUMERIC NOT NULL CHECK (inaltime > 0 AND inaltime <= 100),
    creat_la        TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uq_componenta_schema_tag' AND conrelid = 'componente_schema'::regclass) THEN
        ALTER TABLE componente_schema
            ADD CONSTRAINT uq_componenta_schema_tag UNIQUE (plansa_id, tag_echipament);
    END IF;
END $$;

-- -----------------------------------------------------------------------------
-- 8. VERIFICARI COMPONENTE (istoricul testarii la rece, semnat de inginer)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS verificari_componente (
    id               SERIAL PRIMARY KEY,
    componenta_id    INTEGER NOT NULL REFERENCES componente_schema(id) ON DELETE CASCADE,
    verificat_de_id  INTEGER NOT NULL REFERENCES utilizatori(id) ON DELETE RESTRICT,
    status_test      VARCHAR(20) NOT NULL DEFAULT 'NEVERIFICAT'
                     CHECK (status_test IN ('NEVERIFICAT', 'VERDE', 'GALBEN', 'ROSU', 'NEGRU')),
    observatii       TEXT,
    data_verificare  TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- -----------------------------------------------------------------------------
-- 9. JURNAL ACTIVITATE (audit: cine, ce, cand - sursa pentru performanta)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS jurnal_activitate (
    id             BIGSERIAL PRIMARY KEY,
    utilizator_id  INTEGER REFERENCES utilizatori(id) ON DELETE SET NULL,
    proiect_id     INTEGER REFERENCES proiecte(id)    ON DELETE CASCADE,
    actiune        VARCHAR(40) NOT NULL CHECK (actiune IN (
                       'AUTENTIFICARE',
                       'PROIECT_CREAT', 'PROIECT_MODIFICAT', 'PROIECT_STERS', 'STATUS_SCHIMBAT',
                       'ASIGNARE_ADAUGATA', 'ASIGNARE_MODIFICATA', 'ASIGNARE_STEARSA',
                       'BOM_IMPORTAT', 'COMPONENTA_ADAUGATA', 'COMPONENTA_MODIFICATA',
                       'COMPONENTA_STEARSA', 'COMPONENTA_VERIFICATA', 'COMPONENTA_DEBIFATA',
                       'PLANSA_INCARCATA', 'PLANSA_STEARSA', 'TEST_INREGISTRAT',
                       'UTILIZATOR_CREAT', 'UTILIZATOR_MODIFICAT', 'UTILIZATOR_STERS')),
    detalii        TEXT,
    creat_la       TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- -----------------------------------------------------------------------------
-- 10. VIEW: verificari complete (folosit in rapoarte)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE VIEW v_verificari_complete AS
SELECT v.id            AS verificare_id,
       p.id            AS proiect_id,
       p.cod_comanda,
       ps.numar_pagina,
       c.tag_echipament,
       v.status_test,
       v.observatii,
       v.data_verificare,
       u.nume          AS verificat_de
FROM verificari_componente v
JOIN componente_schema c ON v.componenta_id = c.id
JOIN planse_schema ps    ON c.plansa_id = ps.id
JOIN proiecte p          ON ps.proiect_id = p.id
LEFT JOIN utilizatori u  ON v.verificat_de_id = u.id;

-- -----------------------------------------------------------------------------
-- 11. RESINCRONIZARE SECVENTE
-- Randurile inserate manual cu id explicit (ex: proiecte 104-106) lasa secventa
-- in urma, iar urmatorul INSERT ar da "duplicate key". Secventa este adusa la
-- max(id) doar daca este in urma (nu se intoarce niciodata inapoi).
-- -----------------------------------------------------------------------------
DO $$
DECLARE
    t TEXT;
    secventa TEXT;
    maxim BIGINT;
    curent BIGINT;
BEGIN
    FOREACH t IN ARRAY ARRAY['departamente', 'utilizatori', 'proiecte', 'asignari_proiect', 'componente_proiect',
                             'planse_schema', 'componente_schema', 'verificari_componente', 'jurnal_activitate']
    LOOP
        secventa := pg_get_serial_sequence(t, 'id');
        CONTINUE WHEN secventa IS NULL;
        EXECUTE format('SELECT COALESCE(max(id), 0) FROM %I', t) INTO maxim;
        EXECUTE format('SELECT CASE WHEN is_called THEN last_value ELSE last_value - 1 END FROM %s', secventa) INTO curent;
        IF maxim > curent THEN
            PERFORM setval(secventa, maxim, TRUE);
        END IF;
    END LOOP;
END $$;

-- =============================================================================
-- INDECSI
-- PostgreSQL indexeaza automat doar PRIMARY KEY si UNIQUE. Cheile straine NU
-- sunt indexate implicit, asa ca JOIN-urile si filtrele de mai jos ar face
-- Seq Scan pe tabele intregi. Justificarea cu EXPLAIN ANALYZE (inainte/dupa):
--   npm run db:explain   ->  docs/indecsi-explain.md
-- Indecsii acoperiti deja de constrangeri UNIQUE (coloana de start):
--   asignari_proiect(proiect_id, ...)   -> uq_asignare_proiect_utilizator
--   componente_proiect(proiect_id, ...) -> uq_componenta_proiect_reper
--   planse_schema(proiect_id, ...)      -> uq_proiect_pagina
--   componente_schema(plansa_id, ...)   -> uq_componenta_schema_tag
-- =============================================================================

-- "proiectele mele" (dashboard inginer/operator) + overview echipa
CREATE INDEX IF NOT EXISTS idx_asignari_utilizator
    ON asignari_proiect (utilizator_id);

-- dashboard: filtrare dupa status, ordonare dupa termen limita
CREATE INDEX IF NOT EXISTS idx_proiecte_status_termen
    ON proiecte (status, termen_limita);

-- performanta: cate componente a verificat fiecare angajat (index partial)
CREATE INDEX IF NOT EXISTS idx_componente_verificat_de
    ON componente_proiect (verificat_de, verificat_la)
    WHERE verificat_de IS NOT NULL;

-- ultimul test pentru fiecare componenta (DISTINCT ON ... ORDER BY data DESC)
CREATE INDEX IF NOT EXISTS idx_verificari_componenta_data
    ON verificari_componente (componenta_id, data_verificare DESC);

-- performanta: testele efectuate de fiecare inginer
CREATE INDEX IF NOT EXISTS idx_verificari_utilizator
    ON verificari_componente (verificat_de_id, data_verificare DESC);

-- jurnal: activitatea unui angajat / a unui proiect, cele mai noi primele
CREATE INDEX IF NOT EXISTS idx_jurnal_utilizator_data
    ON jurnal_activitate (utilizator_id, creat_la DESC);
CREATE INDEX IF NOT EXISTS idx_jurnal_proiect_data
    ON jurnal_activitate (proiect_id, creat_la DESC);

-- filtrare utilizatori pe departament
CREATE INDEX IF NOT EXISTS idx_utilizatori_departament
    ON utilizatori (departament_id);
