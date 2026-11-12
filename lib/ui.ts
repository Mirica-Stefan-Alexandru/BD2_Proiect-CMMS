// Helperi de prezentare (fara dependinte server) - folositi in pagini si componente client.

export interface StatusConfig {
    badge: string;
    dot: string;
    bar: string;
    text: string;
    progresImplicit: number;
    etapa: string;
}

export function getStatusConfig(status: string): StatusConfig {
    switch (status) {
        case 'TESTARE_RECE':
            return {
                badge: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
                dot: 'bg-amber-400 animate-pulse',
                bar: 'bg-amber-400',
                text: 'text-amber-300',
                progresImplicit: 85,
                etapa: 'Verificare EPLAN & Continuitate',
            };
        case 'IN_LUCRU':
            return {
                badge: 'bg-sky-500/15 text-sky-300 border-sky-500/30',
                dot: 'bg-sky-400 animate-pulse',
                bar: 'bg-sky-400',
                text: 'text-sky-300',
                progresImplicit: 50,
                etapa: 'Asamblare & Cablare Tablou',
            };
        case 'PLANIFICAT':
            return {
                badge: 'bg-zinc-600/40 text-zinc-200 border-zinc-500/50',
                dot: 'bg-zinc-300',
                bar: 'bg-zinc-400',
                text: 'text-zinc-200',
                progresImplicit: 15,
                etapa: 'Pregatire BOM & Echipamente',
            };
        default:
            return {
                badge: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
                dot: 'bg-emerald-400',
                bar: 'bg-emerald-400',
                text: 'text-emerald-300',
                progresImplicit: 100,
                etapa: 'Finalizat & Receptionat',
            };
    }
}

/**
 * Progresul real al unui proiect: procentul de componente BOM verificate.
 * Daca BOM-ul nu a fost importat inca, se foloseste o estimare dupa status.
 */
export function calculeazaProgres(status: string, totalComponente: number, verificate: number): number {
    if (status === 'FINALIZAT') return 100;
    if (totalComponente > 0) return Math.round((verificate / totalComponente) * 100);
    return getStatusConfig(status).progresImplicit;
}

export function getRoleBadge(rol: string): string {
    switch (rol) {
        case 'MANAGER':
            return 'bg-violet-500/15 text-violet-300 border-violet-500/30';
        case 'INGINER':
            return 'bg-sky-500/15 text-sky-300 border-sky-500/30';
        default:
            return 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30';
    }
}

export function getTestConfig(status: string): { badge: string; fill: string; stroke: string } {
    switch (status) {
        case 'VERDE':
            return { badge: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40', fill: 'rgba(16,185,129,0.18)', stroke: '#10b981' };
        case 'GALBEN':
            return { badge: 'bg-amber-500/15 text-amber-300 border-amber-500/40', fill: 'rgba(245,158,11,0.20)', stroke: '#f59e0b' };
        case 'ROSU':
            return { badge: 'bg-red-500/15 text-red-300 border-red-500/40', fill: 'rgba(239,68,68,0.20)', stroke: '#ef4444' };
        case 'NEGRU':
            return { badge: 'bg-zinc-950 text-zinc-200 border-zinc-500', fill: 'rgba(24,24,27,0.45)', stroke: '#18181b' };
        default:
            return { badge: 'bg-[#222831] text-[#EEEEEE]/70 border-[#EEEEEE]/20', fill: 'rgba(255,211,105,0.18)', stroke: '#FFD369' };
    }
}

export function initiale(nume: string): string {
    return nume
        .split(/\s+/)
        .filter(Boolean)
        .map((n) => n[0])
        .join('')
        .slice(0, 2)
        .toUpperCase();
}

export function zileRamase(termen: string | Date): number {
    const azi = new Date();
    azi.setHours(0, 0, 0, 0);
    const limita = new Date(termen);
    limita.setHours(0, 0, 0, 0);
    return Math.round((limita.getTime() - azi.getTime()) / 86_400_000);
}

export function formatData(d: string | Date | null | undefined): string {
    if (!d) return '-';
    return new Date(d).toLocaleDateString('ro-RO', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export function formatDataOra(d: string | Date | null | undefined): string {
    if (!d) return '-';
    return new Date(d).toLocaleString('ro-RO', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
}

export function formatRelativ(d: string | Date | null | undefined): string {
    if (!d) return 'niciodata';
    const sec = Math.round((Date.now() - new Date(d).getTime()) / 1000);
    if (sec < 60) return 'acum cateva secunde';
    const min = Math.round(sec / 60);
    if (min < 60) return `acum ${min} min`;
    const ore = Math.round(min / 60);
    if (ore < 24) return `acum ${ore} h`;
    const zile = Math.round(ore / 24);
    if (zile < 30) return `acum ${zile} ${zile === 1 ? 'zi' : 'zile'}`;
    return formatData(d);
}

/** Data in format YYYY-MM-DD pentru <input type="date">, fara decalaj de fus orar. */
export function dataPentruInput(d: string | Date): string {
    const x = new Date(d);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())}`;
}

export const LABEL_ACTIUNE: Record<string, string> = {
    AUTENTIFICARE: 'S-a autentificat',
    PROIECT_CREAT: 'A creat proiectul',
    PROIECT_MODIFICAT: 'A modificat proiectul',
    PROIECT_STERS: 'A sters un proiect',
    STATUS_SCHIMBAT: 'A schimbat statusul',
    ASIGNARE_ADAUGATA: 'A asignat un angajat',
    ASIGNARE_MODIFICATA: 'A modificat o asignare',
    ASIGNARE_STEARSA: 'A scos un angajat din echipa',
    BOM_IMPORTAT: 'A importat BOM din EPLAN',
    COMPONENTA_ADAUGATA: 'A adaugat o componenta',
    COMPONENTA_MODIFICATA: 'A modificat o componenta',
    COMPONENTA_STEARSA: 'A sters o componenta',
    COMPONENTA_VERIFICATA: 'A bifat componenta',
    COMPONENTA_DEBIFATA: 'A debifat componenta',
    PLANSA_INCARCATA: 'A incarcat o plansa SVG',
    PLANSA_STEARSA: 'A sters o plansa',
    TEST_INREGISTRAT: 'A semnat un test la rece',
    UTILIZATOR_CREAT: 'A creat un cont',
    UTILIZATOR_MODIFICAT: 'A modificat un cont',
    UTILIZATOR_STERS: 'A sters un cont',
};
