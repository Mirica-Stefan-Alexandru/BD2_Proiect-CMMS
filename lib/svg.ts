// Igienizare SVG. Plansele vin din EPLAN, dar sunt fisiere incarcate de utilizatori
// si sunt inserate in pagina, deci tratam continutul ca nesigur (XSS).

export const MARIME_MAXIMA_SVG = 8 * 1024 * 1024; // 8 MB

/** Verificare + curatare de baza pe server, inainte de salvare. */
export function curataSvgServer(svg: string): string {
    const text = svg.replace(/^\uFEFF/, '').trim();
    if (!/<svg[\s>]/i.test(text)) throw new Error('Fisierul nu este un SVG valid.');
    return text
        .replace(/<!DOCTYPE[\s\S]*?>/gi, '')
        .replace(/<!ENTITY[\s\S]*?>/gi, '')
        .replace(/<script[\s\S]*?<\/script\s*>/gi, '')
        .replace(/<script[^>]*\/>/gi, '')
        .replace(/<foreignObject[\s\S]*?<\/foreignObject\s*>/gi, '')
        .replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
        .replace(/(href\s*=\s*["']?)\s*javascript:[^"'\s>]*/gi, '$1#');
}

const ELEMENTE_INTERZISE = new Set(['script', 'foreignobject', 'iframe', 'object', 'embed', 'audio', 'video', 'animate', 'set', 'animatemotion', 'animatetransform', 'handler', 'listener']);

/**
 * Igienizare completa in browser cu DOMParser: elimina elementele active,
 * atributele de eveniment si legaturile externe/javascript. Returneaza elementul <svg>.
 */
export function curataSvgBrowser(svg: string): SVGSVGElement | null {
    const doc = new DOMParser().parseFromString(svg, 'image/svg+xml');
    if (doc.querySelector('parsererror')) return null;
    const radacina = doc.documentElement;
    if (radacina.nodeName.toLowerCase() !== 'svg') return null;

    const toate = [radacina, ...Array.from(radacina.querySelectorAll('*'))];
    for (const el of toate) {
        if (ELEMENTE_INTERZISE.has(el.nodeName.toLowerCase())) {
            el.remove();
            continue;
        }
        for (const attr of Array.from(el.attributes)) {
            const nume = attr.name.toLowerCase();
            const val = attr.value.trim().toLowerCase();
            if (nume.startsWith('on')) el.removeAttribute(attr.name);
            else if (
                (nume === 'href' || nume === 'xlink:href') &&
                !val.startsWith('#') &&
                !/^data:image\/(png|jpe?g|gif|webp);/.test(val)
            )
                el.removeAttribute(attr.name);
            else if (val.includes('javascript:')) el.removeAttribute(attr.name);
        }
    }
    return radacina as unknown as SVGSVGElement;
}
