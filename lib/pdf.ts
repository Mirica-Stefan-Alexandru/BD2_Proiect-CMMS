// Conversie PDF -> SVG pe server (MuPDF compilat WebAssembly, fara dependinte native).
// Textul din PDF ramane text (<text>/<tspan>), deci reperele EPLAN (-KM1, -QF1) pot fi
// detectate in desen exact ca la un SVG exportat direct din EPLAN.
// Un PDF scanat (doar imagine) nu are text si nu poate fi analizat automat.
import { EroareActiune } from '@/lib/actiuni';

export const MAX_PAGINI_PDF = 40;

export interface RezultatPdf {
    pagini: string[];
    paginiCuText: number;
}

export async function pdfInSvg(date: Uint8Array): Promise<RezultatPdf> {
    const mupdf = await import('mupdf');

    let doc: ReturnType<typeof mupdf.Document.openDocument>;
    try {
        doc = mupdf.Document.openDocument(date, 'application/pdf');
    } catch {
        throw new EroareActiune('Fisierul PDF nu a putut fi citit. Verifica sa nu fie corupt.');
    }

    try {
        if (doc.needsPassword()) throw new EroareActiune('PDF-ul este protejat cu parola. Exporta o varianta fara parola.');
        const total = doc.countPages();
        if (total < 1) throw new EroareActiune('PDF-ul nu contine pagini.');
        if (total > MAX_PAGINI_PDF) {
            throw new EroareActiune(`PDF-ul are ${total} pagini; maximul este ${MAX_PAGINI_PDF}. Imparte-l in mai multe fisiere.`);
        }

        const pagini: string[] = [];
        let paginiCuText = 0;
        for (let i = 0; i < total; i++) {
            const pagina = doc.loadPage(i);
            const buffer = new mupdf.Buffer();
            const scriitor = new mupdf.DocumentWriter(buffer, 'svg', 'text=text');
            const dev = scriitor.beginPage(pagina.getBounds());
            pagina.run(dev, mupdf.Matrix.identity);
            scriitor.endPage();
            scriitor.close();

            const svg = buffer.asString();
            if (/<text[\s>]/.test(svg)) paginiCuText++;
            pagini.push(svg);
        }
        return { pagini, paginiCuText };
    } finally {
        doc.destroy?.();
    }
}
