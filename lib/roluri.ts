// Constante de domeniu partajate intre server si client (fara dependinte server).

export const ROLURI = ['MANAGER', 'INGINER', 'OPERATOR'] as const;
export type Rol = (typeof ROLURI)[number];

export const STATUSURI_PROIECT = ['PLANIFICAT', 'IN_LUCRU', 'TESTARE_RECE', 'FINALIZAT'] as const;
export type StatusProiect = (typeof STATUSURI_PROIECT)[number];

export const STATUSURI_TEST = ['VERDE', 'GALBEN', 'ROSU', 'NEGRU', 'NEVERIFICAT'] as const;
export type StatusTest = (typeof STATUSURI_TEST)[number];

/**
 * Rolurile din santier si ce rol de sistem le poate ocupa.
 * Ex.: testarea la rece trebuie semnata de un inginer, nu de un operator.
 */
export const ROLURI_IN_PROIECT: Record<
    string,
    { label: string; descriere: string; roluriPermise: Rol[] }
> = {
    MANAGER_PROIECT: {
        label: 'Manager proiect',
        descriere: 'Coordoneaza comanda si termenele',
        roluriPermise: ['MANAGER', 'INGINER'],
    },
    PROIECTANT_ELECTRIC: {
        label: 'Proiectant electric',
        descriere: 'Schema EPLAN si lista de materiale',
        roluriPermise: ['INGINER'],
    },
    INGINER_AUTOMATIST: {
        label: 'Inginer automatist',
        descriere: 'Program PLC si punere in functiune',
        roluriPermise: ['INGINER'],
    },
    RESPONSABIL_TESTARE: {
        label: 'Responsabil testare',
        descriere: 'Verificare la rece si semnatura QC',
        roluriPermise: ['INGINER'],
    },
    EXECUTANT_TABLOU: {
        label: 'Executant tablou',
        descriere: 'Montaj mecanic si echipare',
        roluriPermise: ['OPERATOR', 'INGINER'],
    },
    CABLARE_SI_MONTAJ: {
        label: 'Cablare si montaj',
        descriere: 'Cablare conform schemei',
        roluriPermise: ['OPERATOR', 'INGINER'],
    },
};

const NUME_ROL: Record<string, string> = { MANAGER: 'manager', INGINER: 'inginer', OPERATOR: 'operator' };

/** Numele rolului de sistem, pentru texte (ex: "inginer" in loc de "INGINER"). */
export function numeRol(rol: string): string {
    return NUME_ROL[rol] ?? rol.toLowerCase();
}

export function rolInProiectPotrivit(rolInProiect: string, rolSistem: string): boolean {
    const def = ROLURI_IN_PROIECT[rolInProiect];
    return !!def && def.roluriPermise.includes(rolSistem as Rol);
}

export const LABEL_STATUS: Record<string, string> = {
    PLANIFICAT: 'Planificat',
    IN_LUCRU: 'In lucru',
    TESTARE_RECE: 'Testare la rece',
    FINALIZAT: 'Finalizat',
};

export const LABEL_TEST: Record<string, string> = {
    VERDE: 'Conform',
    GALBEN: 'Remediere minora',
    ROSU: 'Neconform',
    NEGRU: 'Lipsa / gresit',
    NEVERIFICAT: 'Neverificat',
};
