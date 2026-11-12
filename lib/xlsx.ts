// Generator minimal de fisiere Excel .xlsx (Office Open XML), fara dependinte.
// Arhiva ZIP este scrisa in modul "store" (fara compresie) - suficient pentru rapoarte.
// Celulele text sunt "inlineStr", deci Excel nu interpreteaza niciodata formule (ex: -KM1).

export interface FoaieXlsx {
    nume: string;
    header: string[];
    randuri: unknown[][];
}

const enc = new TextEncoder();

const TABEL_CRC = (() => {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
        let c = n;
        for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
        t[n] = c >>> 0;
    }
    return t;
})();

function crc32(data: Uint8Array): number {
    let c = 0xffffffff;
    for (let i = 0; i < data.length; i++) c = TABEL_CRC[(c ^ data[i]) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
}

function zip(fisiere: { nume: string; date: Uint8Array }[]): Uint8Array {
    const acum = new Date();
    const ora = (acum.getHours() << 11) | (acum.getMinutes() << 5) | (acum.getSeconds() >> 1);
    const zi = ((acum.getFullYear() - 1980) << 9) | ((acum.getMonth() + 1) << 5) | acum.getDate();

    const parti: Uint8Array[] = [];
    const central: Uint8Array[] = [];
    let offset = 0;

    for (const f of fisiere) {
        const nume = enc.encode(f.nume);
        const crc = crc32(f.date);

        const local = new DataView(new ArrayBuffer(30));
        local.setUint32(0, 0x04034b50, true);
        local.setUint16(4, 20, true);
        local.setUint16(6, 0x0800, true); // nume UTF-8
        local.setUint16(8, 0, true); // store
        local.setUint16(10, ora, true);
        local.setUint16(12, zi, true);
        local.setUint32(14, crc, true);
        local.setUint32(18, f.date.length, true);
        local.setUint32(22, f.date.length, true);
        local.setUint16(26, nume.length, true);
        local.setUint16(28, 0, true);
        parti.push(new Uint8Array(local.buffer), nume, f.date);

        const cd = new DataView(new ArrayBuffer(46));
        cd.setUint32(0, 0x02014b50, true);
        cd.setUint16(4, 20, true);
        cd.setUint16(6, 20, true);
        cd.setUint16(8, 0x0800, true);
        cd.setUint16(10, 0, true);
        cd.setUint16(12, ora, true);
        cd.setUint16(14, zi, true);
        cd.setUint32(16, crc, true);
        cd.setUint32(20, f.date.length, true);
        cd.setUint32(24, f.date.length, true);
        cd.setUint16(28, nume.length, true);
        cd.setUint32(42, offset, true);
        central.push(new Uint8Array(cd.buffer), nume);

        offset += 30 + nume.length + f.date.length;
    }

    const marimeCentral = central.reduce((s, p) => s + p.length, 0);
    const sfarsit = new DataView(new ArrayBuffer(22));
    sfarsit.setUint32(0, 0x06054b50, true);
    sfarsit.setUint16(8, fisiere.length, true);
    sfarsit.setUint16(10, fisiere.length, true);
    sfarsit.setUint32(12, marimeCentral, true);
    sfarsit.setUint32(16, offset, true);

    const toate = [...parti, ...central, new Uint8Array(sfarsit.buffer)];
    const rezultat = new Uint8Array(toate.reduce((s, p) => s + p.length, 0));
    let pos = 0;
    for (const p of toate) {
        rezultat.set(p, pos);
        pos += p.length;
    }
    return rezultat;
}

const xml = (s: string) =>
    s
        // caracterele de control sunt interzise in XML
        .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');

function coloana(i: number): string {
    let s = '';
    let n = i + 1;
    while (n > 0) {
        const r = (n - 1) % 26;
        s = String.fromCharCode(65 + r) + s;
        n = Math.floor((n - 1) / 26);
    }
    return s;
}

function celula(v: unknown, ref: string, stil = 0): string {
    const s = stil ? ` s="${stil}"` : '';
    if (v === null || v === undefined || v === '') return `<c r="${ref}"${s}/>`;
    if (typeof v === 'number' && Number.isFinite(v)) return `<c r="${ref}"${s}><v>${v}</v></c>`;
    let text: string;
    if (typeof v === 'boolean') text = v ? 'DA' : 'NU';
    else if (v instanceof Date) text = v.toLocaleString('ro-RO');
    else text = String(v);
    return `<c r="${ref}" t="inlineStr"${s}><is><t xml:space="preserve">${xml(text.slice(0, 32000))}</t></is></c>`;
}

function foaie(f: FoaieXlsx): string {
    const toate = [f.header, ...f.randuri];
    const latimi = f.header.map((_, c) =>
        Math.min(60, Math.max(8, ...toate.map((r) => String(r[c] ?? '').length + 2)))
    );
    const cols = latimi.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join('');
    const randuri = toate
        .map((r, ri) => `<row r="${ri + 1}">${r.map((v, ci) => celula(v, `${coloana(ci)}${ri + 1}`, ri === 0 ? 1 : 0)).join('')}</row>`)
        .join('');
    const ultima = `${coloana(Math.max(0, f.header.length - 1))}${toate.length}`;
    return (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
        '<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>' +
        `<cols>${cols}</cols><sheetData>${randuri}</sheetData><autoFilter ref="A1:${ultima}"/></worksheet>`
    );
}

export function genereazaXlsx(foi: FoaieXlsx[]): Uint8Array {
    const nume = foi.map((f, i) => (f.nume.replace(/[[\]:*?/\\]/g, ' ').slice(0, 31) || `Foaie${i + 1}`));
    const ct =
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
        '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
        '<Default Extension="xml" ContentType="application/xml"/>' +
        '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
        '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
        foi.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('') +
        '</Types>';
    const rels =
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>' +
        '</Relationships>';
    const workbook =
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>' +
        nume.map((n, i) => `<sheet name="${xml(n)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('') +
        '</sheets></workbook>';
    const wbRels =
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
        foi.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('') +
        `<Relationship Id="rId${foi.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>` +
        '</Relationships>';
    const stiluri =
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
        '<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><color rgb="FF222831"/><name val="Calibri"/></font></fonts>' +
        '<fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill>' +
        '<fill><patternFill patternType="solid"><fgColor rgb="FFFFD369"/><bgColor indexed="64"/></patternFill></fill></fills>' +
        '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>' +
        '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
        '<cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>' +
        '<xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/></cellXfs>' +
        '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>' +
        '</styleSheet>';

    return zip([
        { nume: '[Content_Types].xml', date: enc.encode(ct) },
        { nume: '_rels/.rels', date: enc.encode(rels) },
        { nume: 'xl/workbook.xml', date: enc.encode(workbook) },
        { nume: 'xl/_rels/workbook.xml.rels', date: enc.encode(wbRels) },
        { nume: 'xl/styles.xml', date: enc.encode(stiluri) },
        ...foi.map((f, i) => ({ nume: `xl/worksheets/sheet${i + 1}.xml`, date: enc.encode(foaie(f)) })),
    ]);
}
