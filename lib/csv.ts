// Parser / generator CSV fara dependinte. Folosit in browser (import BOM EPLAN)
// si pe server (export rapoarte).

/** Detecteaza separatorul dupa prima linie: ; (EPLAN in setari RO/DE), , sau TAB. */
export function detecteazaSeparator(text: string): string {
    const primaLinie = text.split(/\r?\n/, 1)[0] ?? '';
    const candidati = [';', ',', '\t'];
    let best = ',';
    let max = -1;
    for (const c of candidati) {
        const n = primaLinie.split(c).length;
        if (n > max) {
            max = n;
            best = c;
        }
    }
    return best;
}

/** Parser RFC 4180 (ghilimele, ghilimele dublate, linii noi in campuri). */
export function parseCsv(text: string, separator = detecteazaSeparator(text)): string[][] {
    const src = text.replace(/^\uFEFF/, '');
    const randuri: string[][] = [];
    let rand: string[] = [];
    let camp = '';
    let inGhilimele = false;

    for (let i = 0; i < src.length; i++) {
        const ch = src[i];
        if (inGhilimele) {
            if (ch === '"') {
                if (src[i + 1] === '"') {
                    camp += '"';
                    i++;
                } else {
                    inGhilimele = false;
                }
            } else {
                camp += ch;
            }
        } else if (ch === '"' && camp === '') {
            inGhilimele = true;
        } else if (ch === separator) {
            rand.push(camp);
            camp = '';
        } else if (ch === '\n' || ch === '\r') {
            if (ch === '\r' && src[i + 1] === '\n') i++;
            rand.push(camp);
            randuri.push(rand);
            rand = [];
            camp = '';
        } else {
            camp += ch;
        }
    }
    if (camp !== '' || rand.length > 0) {
        rand.push(camp);
        randuri.push(rand);
    }
    return randuri.filter((r) => r.some((c) => c.trim() !== ''));
}

// ---- mapare coloane EPLAN "Parts list" -> componente_proiect -----------------

export type CampBom = 'cod_reper' | 'descriere' | 'producator' | 'cantitate' | 'observatii';

const SINONIME: Record<CampBom, string[]> = {
    cod_reper: ['cod_reper', 'cod reper', 'reper', 'device tag', 'devicetag', 'dt', 'bmk', 'betriebsmittelkennzeichen', 'tag', 'identificator', 'eticheta', 'cod'],
    descriere: ['descriere', 'description', 'designation', 'denumire', 'part description', 'bezeichnung', 'beschreibung', 'designation 1', 'part designation'],
    producator: ['producator', 'manufacturer', 'hersteller', 'brand', 'furnizor', 'manufacturer name'],
    cantitate: ['cantitate', 'quantity', 'qty', 'menge', 'anzahl', 'buc', 'count', 'nr'],
    observatii: ['observatii', 'comment', 'comments', 'notes', 'note', 'bemerkung', 'remark'],
};

const normalizeaza = (s: string) =>
    s
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[_.]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

export function mapeazaColoane(header: string[]): Partial<Record<CampBom, number>> {
    const map: Partial<Record<CampBom, number>> = {};
    const h = header.map(normalizeaza);
    (Object.keys(SINONIME) as CampBom[]).forEach((camp) => {
        const sin = SINONIME[camp].map(normalizeaza);
        let idx = h.findIndex((col) => sin.includes(col));
        if (idx === -1) idx = h.findIndex((col) => sin.some((s) => s.length > 3 && col.includes(s)));
        if (idx !== -1 && !Object.values(map).includes(idx)) map[camp] = idx;
    });
    return map;
}

export interface RandBom {
    cod_reper: string;
    descriere: string;
    producator: string;
    cantitate: number;
    observatii: string;
}

export interface RezultatParsareBom {
    randuri: RandBom[];
    erori: string[];
    coloane: Partial<Record<CampBom, string>>;
    duplicateUnite: number;
}

/** Transforma textul CSV in randuri BOM validate; reperele duplicate sunt unite. */
export function parseazaBom(text: string): RezultatParsareBom {
    const tabel = parseCsv(text);
    if (tabel.length < 2) return { randuri: [], erori: ['Fisierul nu contine date (minim antet + un rand).'], coloane: {}, duplicateUnite: 0 };

    const header = tabel[0];
    const map = mapeazaColoane(header);
    const coloane: Partial<Record<CampBom, string>> = {};
    (Object.keys(map) as CampBom[]).forEach((k) => (coloane[k] = header[map[k]!]));

    if (map.cod_reper === undefined || map.descriere === undefined) {
        return {
            randuri: [],
            erori: ['Nu am gasit coloanele obligatorii "Device tag / Cod reper" si "Description / Descriere" in antet.'],
            coloane,
            duplicateUnite: 0,
        };
    }

    const erori: string[] = [];
    const dupaCod = new Map<string, RandBom>();
    let duplicateUnite = 0;

    tabel.slice(1).forEach((r, i) => {
        const linie = i + 2;
        const cod = (r[map.cod_reper!] ?? '').trim();
        const descriere = (r[map.descriere!] ?? '').trim();
        if (!cod && !descriere) return;
        if (!cod) return void erori.push(`Linia ${linie}: lipseste codul reperului.`);
        if (cod.length > 60) return void erori.push(`Linia ${linie}: codul "${cod.slice(0, 20)}..." depaseste 60 caractere.`);
        if (!descriere) return void erori.push(`Linia ${linie}: ${cod} nu are descriere.`);

        const cantBrut = map.cantitate !== undefined ? (r[map.cantitate] ?? '').trim().replace(',', '.') : '1';
        const cantitate = cantBrut === '' ? 1 : Math.round(Number(cantBrut));
        if (!Number.isFinite(cantitate) || cantitate <= 0) return void erori.push(`Linia ${linie}: cantitate invalida pentru ${cod}.`);

        const rand: RandBom = {
            cod_reper: cod,
            descriere: descriere.slice(0, 1000),
            producator: map.producator !== undefined ? (r[map.producator] ?? '').trim().slice(0, 120) : '',
            cantitate,
            observatii: map.observatii !== undefined ? (r[map.observatii] ?? '').trim().slice(0, 1000) : '',
        };

        const existent = dupaCod.get(cod);
        if (existent) {
            // acelasi reper pe mai multe randuri (ex: contactor + bloc contacte auxiliare)
            duplicateUnite++;
            if (!existent.descriere.includes(rand.descriere)) {
                existent.descriere = `${existent.descriere} + ${rand.descriere}`.slice(0, 1000);
            }
            existent.cantitate += rand.cantitate;
            existent.producator ||= rand.producator;
        } else {
            dupaCod.set(cod, rand);
        }
    });

    return { randuri: [...dupaCod.values()], erori, coloane, duplicateUnite };
}

// ---- generare CSV ---------------------------------------------------------------

/**
 * Valoare CSV sigura: ghilimele cand e nevoie si protectie la "CSV injection"
 * (celulele care incep cu = + @ TAB CR sunt prefixate cu apostrof).
 * Codurile EPLAN care incep cu "-" (ex: -KM1) sunt pastrate; nu pot executa formule
 * deoarece nu contin paranteze sau operatori.
 */
export function celulaCsv(v: unknown, separator = ','): string {
    if (v === null || v === undefined) return '';
    let s = v instanceof Date ? v.toISOString() : String(v);
    if (/^[=+@\t\r]/.test(s) || (/^-/.test(s) && /[(!|]/.test(s))) s = `'${s}`;
    if (s.includes('"') || s.includes(separator) || s.includes('\n') || s.includes('\r')) {
        s = `"${s.replace(/"/g, '""')}"`;
    }
    return s;
}

export function genereazaCsv(header: string[], randuri: unknown[][], separator = ','): string {
    const linii = [header, ...randuri].map((r) => r.map((c) => celulaCsv(c, separator)).join(separator));
    return '\uFEFF' + linii.join('\r\n') + '\r\n'; // BOM UTF-8 pentru diacritice corecte in Excel
}
