-- =============================================================================
-- CMMS Industrial - FIXTURES (date de test)
-- -----------------------------------------------------------------------------
-- Rulat automat la pornirea serverului DOAR daca tabela "utilizatori" este goala
-- (vezi lib/migrations.ts). Pe o baza care are deja date nu se executa nimic.
-- Fortare manuala pe o baza goala:  npm run db:seed
--
-- Toate conturile de test au parola:  Parola2026!
-- (hash bcrypt, cost 10 - parola nu este stocata niciodata in clar)
-- Termenele limita sunt relative la data rularii (CURRENT_DATE + n zile),
-- ca datele sa ramana realiste indiferent cand se porneste aplicatia.
-- =============================================================================

INSERT INTO departamente (cod_departament, denumire) VALUES
    ('ELEC', 'Proiectare Electrica'),
    ('CAB',  'Cablare si Montaj Panouri'),
    ('QC',   'Control Calitate si Testare'),
    ('MNG',  'Management Proiecte')
ON CONFLICT (cod_departament) DO NOTHING;

INSERT INTO utilizatori (nume, email, parola_hash, rol, departament_id) VALUES
    ('Cristian Dumitru', 'cristian.dumitru@factory.ro', '$2b$10$LUsS/Ct53Et.vvOtA5jrZOrPzXCxmDfBxnU5EGOnfdVwIF4Nyy8/G', 'MANAGER',
        (SELECT id FROM departamente WHERE cod_departament = 'MNG')),
    ('Mihai Ionescu',    'mihai.ionescu@factory.ro',    '$2b$10$LUsS/Ct53Et.vvOtA5jrZOrPzXCxmDfBxnU5EGOnfdVwIF4Nyy8/G', 'INGINER',
        (SELECT id FROM departamente WHERE cod_departament = 'QC')),
    ('Elena Radu',       'elena.radu@factory.ro',       '$2b$10$LUsS/Ct53Et.vvOtA5jrZOrPzXCxmDfBxnU5EGOnfdVwIF4Nyy8/G', 'INGINER',
        (SELECT id FROM departamente WHERE cod_departament = 'ELEC')),
    ('Alexandra Matei',  'alexandra.matei@factory.ro',  '$2b$10$LUsS/Ct53Et.vvOtA5jrZOrPzXCxmDfBxnU5EGOnfdVwIF4Nyy8/G', 'INGINER',
        (SELECT id FROM departamente WHERE cod_departament = 'ELEC')),
    ('Ion Popescu',      'ion.popescu@factory.ro',      '$2b$10$LUsS/Ct53Et.vvOtA5jrZOrPzXCxmDfBxnU5EGOnfdVwIF4Nyy8/G', 'OPERATOR',
        (SELECT id FROM departamente WHERE cod_departament = 'CAB')),
    ('Andrei Vasile',    'andrei.vasile@factory.ro',    '$2b$10$LUsS/Ct53Et.vvOtA5jrZOrPzXCxmDfBxnU5EGOnfdVwIF4Nyy8/G', 'OPERATOR',
        (SELECT id FROM departamente WHERE cod_departament = 'CAB')),
    ('Radu Constantin',  'radu.constantin@factory.ro',  '$2b$10$LUsS/Ct53Et.vvOtA5jrZOrPzXCxmDfBxnU5EGOnfdVwIF4Nyy8/G', 'OPERATOR',
        (SELECT id FROM departamente WHERE cod_departament = 'CAB'))
ON CONFLICT (email) DO NOTHING;

INSERT INTO proiecte (cod_comanda, titlu, descriere, status, creat_de_id, termen_limita, finalizat_la) VALUES
    ('CMD-2026-001', 'Tablou Automatizare Linie Imbuteliere',
        'Tablou de automatizare cu PLC S7-1500 pentru linia de imbuteliere 2.', 'TESTARE_RECE',
        (SELECT id FROM utilizatori WHERE email = 'cristian.dumitru@factory.ro'), CURRENT_DATE + 6, NULL),
    ('CMD-2026-002', 'Panou Distributie Principal Hala 2',
        'TGD 630A cu analizor de retea si plecari MCCB pentru halele A si B.', 'IN_LUCRU',
        (SELECT id FROM utilizatori WHERE email = 'cristian.dumitru@factory.ro'), CURRENT_DATE + 22, NULL),
    ('CMD-2026-003', 'Dulap Comanda Celula Robotizata',
        'Dulap de comanda pentru celula de sudura robotizata, circuite de siguranta PLe.', 'PLANIFICAT',
        (SELECT id FROM utilizatori WHERE email = 'cristian.dumitru@factory.ro'), CURRENT_DATE + 72, NULL),
    ('CMD-2026-004', 'Tablou Comanda Pompa Hidraulica Submersibila',
        'Tablou forta si comanda pentru pompa submersibila 15kW cu modul LOGO!.', 'TESTARE_RECE',
        (SELECT id FROM utilizatori WHERE email = 'cristian.dumitru@factory.ro'), CURRENT_DATE - 3, NULL),
    ('CMD-2026-005', 'Dulap Automatizare Sistem Sortare Conveior',
        'Automatizare conveior de sortare cu doua convertizoare si bariere optice.', 'IN_LUCRU',
        (SELECT id FROM utilizatori WHERE email = 'cristian.dumitru@factory.ro'), CURRENT_DATE + 41, NULL),
    ('CMD-2026-006', 'Panou Alimentare Statie Tratare Apa Reziduala',
        'Panou de alimentare si comanda pompe dozare pentru statia de epurare.', 'PLANIFICAT',
        (SELECT id FROM utilizatori WHERE email = 'cristian.dumitru@factory.ro'), CURRENT_DATE + 126, NULL),
    ('CMD-2026-007', 'Tablou Iluminat Hala Depozitare',
        'Tablou iluminat cu comanda DALI si circuite de siguranta.', 'FINALIZAT',
        (SELECT id FROM utilizatori WHERE email = 'cristian.dumitru@factory.ro'), CURRENT_DATE - 12, NOW() - INTERVAL '15 days')
ON CONFLICT (cod_comanda) DO NOTHING;

-- echipele de proiect
INSERT INTO asignari_proiect (proiect_id, utilizator_id, rol_in_proiect, asignat_de)
SELECT p.id, u.id, a.rol, (SELECT id FROM utilizatori WHERE email = 'cristian.dumitru@factory.ro')
FROM (VALUES
    ('CMD-2026-001', 'mihai.ionescu@factory.ro',   'RESPONSABIL_TESTARE'),
    ('CMD-2026-001', 'elena.radu@factory.ro',      'PROIECTANT_ELECTRIC'),
    ('CMD-2026-001', 'ion.popescu@factory.ro',     'EXECUTANT_TABLOU'),
    ('CMD-2026-002', 'elena.radu@factory.ro',      'RESPONSABIL_TESTARE'),
    ('CMD-2026-002', 'andrei.vasile@factory.ro',   'CABLARE_SI_MONTAJ'),
    ('CMD-2026-003', 'alexandra.matei@factory.ro', 'INGINER_AUTOMATIST'),
    ('CMD-2026-004', 'mihai.ionescu@factory.ro',   'RESPONSABIL_TESTARE'),
    ('CMD-2026-004', 'ion.popescu@factory.ro',     'EXECUTANT_TABLOU'),
    ('CMD-2026-005', 'alexandra.matei@factory.ro', 'PROIECTANT_ELECTRIC'),
    ('CMD-2026-005', 'andrei.vasile@factory.ro',   'CABLARE_SI_MONTAJ'),
    ('CMD-2026-005', 'radu.constantin@factory.ro', 'EXECUTANT_TABLOU'),
    ('CMD-2026-006', 'cristian.dumitru@factory.ro','MANAGER_PROIECT'),
    ('CMD-2026-006', 'elena.radu@factory.ro',      'INGINER_AUTOMATIST'),
    ('CMD-2026-007', 'mihai.ionescu@factory.ro',   'RESPONSABIL_TESTARE'),
    ('CMD-2026-007', 'radu.constantin@factory.ro', 'EXECUTANT_TABLOU')
) AS a(cod, email, rol)
JOIN proiecte p    ON p.cod_comanda = a.cod
JOIN utilizatori u ON u.email = a.email
ON CONFLICT (proiect_id, utilizator_id) DO NOTHING;

-- BOM (lista de materiale exportata din EPLAN)
INSERT INTO componente_proiect (proiect_id, cod_reper, descriere, producator, cantitate, verificat, verificat_de, verificat_la, observatii)
SELECT p.id, c.cod, c.descr, c.prod, c.cant, c.verif,
       (SELECT id FROM utilizatori WHERE email = c.email),
       CASE WHEN c.verif THEN NOW() - (c.zile || ' days')::interval END,
       c.obs
FROM (VALUES
    ('CMD-2026-004', '-QF1',   'Intrerupator automat tripolar 32A C-curve',           'Schneider Electric', 1,  TRUE,  'ion.popescu@factory.ro',   9, 'Test declansare termica si scurtcircuit OK'),
    ('CMD-2026-004', '-KM1',   'Contactor forta 18.5kW 400V AC3 bobina 24VDC',        'Siemens',            1,  TRUE,  'ion.popescu@factory.ro',   8, 'Continuitate contacte forta si auxiliare OK'),
    ('CMD-2026-004', '-FR1',   'Releu protectie termica 28-36A',                      'Schneider Electric', 1,  TRUE,  'mihai.ionescu@factory.ro', 5, 'Calibrat la 31.5A curent nominal pompa'),
    ('CMD-2026-004', '-KF1',   'Releu monitorizare succesiune si asimetrie faze',     'Finder',             1,  TRUE,  'mihai.ionescu@factory.ro', 4, 'Detectie lipsa faza testata'),
    ('CMD-2026-004', '-PLC1',  'Modul logic LOGO! 24RCE + Modul extensie 4DI/4DO',    'Siemens',            1,  FALSE, NULL,                       0, 'In asteptare incarcare program'),
    ('CMD-2026-004', '-X1',    'Bloc cleme trecere 6mm2 cu siguranta fuzibila',       'Phoenix Contact',    24, TRUE,  'ion.popescu@factory.ro',   7, 'Strangere la cuplu 1.2Nm efectuata'),
    ('CMD-2026-004', '-M1',    'Pompa submersibila 15kW (conexiune la clemele -X1)',  'Grundfos',           1,  FALSE, NULL,                       0, NULL),
    ('CMD-2026-005', '-QM1',   'Separator de sarcina principal 63A maner rotativ',    'ABB',                1,  TRUE,  'andrei.vasile@factory.ro', 6, 'Montat pe usa tabloului'),
    ('CMD-2026-005', '-PLC1',  'CPU Siemens S7-1200 1214C DC/DC/DC',                  'Siemens',            1,  FALSE, NULL,                       0, 'Cablaj PROFINET in curs'),
    ('CMD-2026-005', '-U1',    'Convertizor de frecventa 5.5kW IP20 (VFD)',           'Danfoss',            2,  FALSE, NULL,                       0, 'Asteapta rezistenta de franare'),
    ('CMD-2026-005', '-PS1',   'Sursa in comutatie 24VDC 10A SITOP PSU100S',          'Siemens',            1,  TRUE,  'radu.constantin@factory.ro', 3, 'Tensiune iesire 24.1V stabil'),
    ('CMD-2026-005', '-SF1',   'Bariera optica de siguranta SIL3 / PLe',              'Sick',               2,  FALSE, NULL,                       0, 'Nemontat'),
    ('CMD-2026-005', '-K1..K8','Relee intermediare interfata cu soclu 24VDC',         'Finder',             8,  TRUE,  'radu.constantin@factory.ro', 2, 'Diode flyback verificate'),
    ('CMD-2026-006', '-QF1',   'Disjunctor compact 100A 3P 36kA',                     'Eaton',              1,  FALSE, NULL,                       0, 'Livrare estimata saptamana viitoare'),
    ('CMD-2026-006', '-PLC1',  'Statie distribuita ET200SP + module analogice 4-20mA','Siemens',            1,  FALSE, NULL,                       0, NULL),
    ('CMD-2026-006', '-US1',   'Senzor nivel ultrasonic cu iesire Modbus RTU',        'Endress+Hauser',     4,  FALSE, NULL,                       0, NULL),
    ('CMD-2026-001', '-Q1',    'Disjunctor motor 4-6.3A',                             'Siemens',            1,  TRUE,  'ion.popescu@factory.ro',   12, NULL),
    ('CMD-2026-001', '-K1',    'Contactor forta 24VDC 9A',                            'Siemens',            1,  TRUE,  'ion.popescu@factory.ro',   12, NULL),
    ('CMD-2026-001', '-F1',    'Releu termic protectie suprasarcina',                 'Siemens',            1,  TRUE,  'ion.popescu@factory.ro',   11, NULL),
    ('CMD-2026-001', '-Q2',    'Disjunctor motor 9-14A',                              'Siemens',            1,  FALSE, NULL,                       0, 'Montat calibru gresit, de inlocuit'),
    ('CMD-2026-001', '-T1',    'Sursa 230VAC/24VDC 10A',                              'Phoenix Contact',    1,  TRUE,  'elena.radu@factory.ro',    10, NULL),
    ('CMD-2026-007', '-QF1',   'Intrerupator automat 4P 40A',                         'ABB',                1,  TRUE,  'radu.constantin@factory.ro', 20, NULL),
    ('CMD-2026-007', '-DALI1', 'Controller iluminat DALI 64 adrese',                  'Tridonic',           1,  TRUE,  'mihai.ionescu@factory.ro', 18, 'Adresare corpuri verificata')
) AS c(cod_comanda, cod, descr, prod, cant, verif, email, zile, obs)
JOIN proiecte p ON p.cod_comanda = c.cod_comanda
ON CONFLICT (proiect_id, cod_reper) DO NOTHING;

-- planse raster (pozitii salvate in procente; fisierul SVG demo se adauga din cod)
INSERT INTO planse_schema (proiect_id, numar_pagina, titlu_pagina, cale_fisier)
SELECT p.id, s.pag, s.titlu, s.cale
FROM (VALUES
    ('CMD-2026-001', 1, 'Distributie Tensiune Comanda 24VDC',      '/schematics/cmd-001/page_02.png'),
    ('CMD-2026-001', 2, 'Circuite Pornire Motoare si Contactoare', '/schematics/cmd-001/page_03.png'),
    ('CMD-2026-002', 1, 'Sursa si Sosire Transformator 630A',      '/schematics/cmd-002/page_01.png')
) AS s(cod, pag, titlu, cale)
JOIN proiecte p ON p.cod_comanda = s.cod
ON CONFLICT (proiect_id, numar_pagina) DO NOTHING;

INSERT INTO componente_schema (plansa_id, tag_echipament, descriere_tip, pos_x, pos_y, latime, inaltime)
SELECT ps.id, c.tag, c.descr, c.x, c.y, c.w, c.h
FROM (VALUES
    ('CMD-2026-001', 2, '-Q1',  'Disjunctor motor 4-6.3A',               15.2, 22.5, 6.5, 4.2),
    ('CMD-2026-001', 2, '-K1',  'Contactor forta 24VDC 9A',              15.2, 35.8, 6.5, 5.0),
    ('CMD-2026-001', 2, '-F1',  'Releu termic protectie suprasarcina',   15.2, 48.0, 6.5, 4.5),
    ('CMD-2026-001', 2, '-Q2',  'Disjunctor motor 9-14A',                38.5, 22.5, 6.5, 4.2),
    ('CMD-2026-001', 1, '-T1',  'Sursa alimentare 230VAC/24VDC 10A',     20.0, 18.4, 10.5, 8.0),
    ('CMD-2026-001', 1, '-F10', 'Siguranta automata 24VDC 2A',           45.0, 40.2, 4.5, 3.5),
    ('CMD-2026-002', 1, '-Q01', 'Intreruptor automat debrosabil 3P 630A',18.0, 15.0, 12.0, 8.5),
    ('CMD-2026-002', 1, '-P1',  'Analizor de retea trifazat',            45.0, 20.0, 8.0, 6.0),
    ('CMD-2026-002', 1, '-Q10', 'MCCB 3P 160A plecare Hala A',           18.0, 50.0, 7.0, 6.0)
) AS c(cod, pag, tag, descr, x, y, w, h)
JOIN proiecte p       ON p.cod_comanda = c.cod
JOIN planse_schema ps ON ps.proiect_id = p.id AND ps.numar_pagina = c.pag
ON CONFLICT (plansa_id, tag_echipament) DO NOTHING;

-- istoricul testarii la rece
INSERT INTO verificari_componente (componenta_id, verificat_de_id, status_test, observatii, data_verificare)
SELECT cs.id, u.id, v.status, v.obs, NOW() - (v.zile || ' days')::interval
FROM (VALUES
    ('CMD-2026-001', '-Q1',  'mihai.ionescu@factory.ro', 'VERDE',  'Reglaj curent termic verificat la 5.5A', 6),
    ('CMD-2026-001', '-K1',  'mihai.ionescu@factory.ro', 'VERDE',  'Bobina verificata la 24VDC', 6),
    ('CMD-2026-001', '-F1',  'mihai.ionescu@factory.ro', 'GALBEN', 'Necesita strangere borna 95-96', 5),
    ('CMD-2026-001', '-Q2',  'mihai.ionescu@factory.ro', 'NEGRU',  'Montat disjunctor 2.5-4A in loc de 9-14A', 5),
    ('CMD-2026-001', '-T1',  'elena.radu@factory.ro',    'VERDE',  'Tensiune iesire reglata la 24.2VDC', 4),
    ('CMD-2026-002', '-Q01', 'elena.radu@factory.ro',    'VERDE',  'Reglaj Ir setat la 500A', 3),
    ('CMD-2026-002', '-P1',  'elena.radu@factory.ro',    'ROSU',   'Sens secundar TC inversat pe L2', 2)
) AS v(cod, tag, email, status, obs, zile)
JOIN proiecte p           ON p.cod_comanda = v.cod
JOIN planse_schema ps     ON ps.proiect_id = p.id
JOIN componente_schema cs ON cs.plansa_id = ps.id AND cs.tag_echipament = v.tag
JOIN utilizatori u        ON u.email = v.email;

-- jurnal initial
INSERT INTO jurnal_activitate (utilizator_id, proiect_id, actiune, detalii, creat_la)
SELECT u.id, p.id, j.actiune, j.detalii, NOW() - (j.zile || ' days')::interval
FROM (VALUES
    ('cristian.dumitru@factory.ro', 'CMD-2026-004', 'PROIECT_CREAT',     'Proiect creat',                       20),
    ('cristian.dumitru@factory.ro', 'CMD-2026-004', 'ASIGNARE_ADAUGATA', 'Mihai Ionescu - RESPONSABIL_TESTARE', 19),
    ('mihai.ionescu@factory.ro',    'CMD-2026-004', 'BOM_IMPORTAT',      '7 componente importate din EPLAN',     18),
    ('ion.popescu@factory.ro',      'CMD-2026-004', 'COMPONENTA_VERIFICATA', '-QF1',                             9),
    ('ion.popescu@factory.ro',      'CMD-2026-004', 'COMPONENTA_VERIFICATA', '-KM1',                             8),
    ('mihai.ionescu@factory.ro',    'CMD-2026-004', 'STATUS_SCHIMBAT',   'IN_LUCRU -> TESTARE_RECE',             6),
    ('elena.radu@factory.ro',       'CMD-2026-002', 'TEST_INREGISTRAT',  '-P1: ROSU',                            2)
) AS j(email, cod, actiune, detalii, zile)
JOIN utilizatori u ON u.email = j.email
JOIN proiecte p    ON p.cod_comanda = j.cod;
