export interface ComponentaBom {
    id: number;
    cod_reper: string;
    descriere: string;
    producator: string | null;
    cantitate: number | null;
    verificat: boolean;
    verificat_de: number | null;
    verificat_de_nume: string | null;
    verificat_la: string | null;
    observatii: string | null;
}

export interface TestIstoric {
    id: number;
    status_test: string;
    observatii: string | null;
    data_verificare: string;
    verificat_de: string | null;
}

export interface ComponentaSchema {
    id: number;
    plansa_id: number;
    numar_pagina: number;
    tag_echipament: string;
    descriere_tip: string;
    pos_x: number;
    pos_y: number;
    latime: number;
    inaltime: number;
    ultim_status: string | null;
    istoric: TestIstoric[];
}

export interface Plansa {
    id: number;
    numar_pagina: number;
    titlu_pagina: string;
    cale_fisier: string;
    are_svg: boolean;
    creat_la: string;
}

export interface Permisiuni {
    poateBifa: boolean;
    poateEdita: boolean;
    poateTesta: boolean;
}
