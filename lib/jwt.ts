// Configuratie comuna pentru semnarea / verificarea token-urilor JWT.
// Folosit de proxy.ts, de ruta de login si de lib/session.ts.

export const SESSION_COOKIE = 'cmms_session';
export const SESSION_DURATA_SECUNDE = 60 * 60 * 8; // 8 ore - o tura de lucru

const CHEIE_DEZVOLTARE = 'cheie_secreta_cmms_proiect_2026_securizata';

function cheieSecreta(): string {
    const cheie = process.env.JWT_SECRET;
    if (cheie && cheie.length >= 32) return cheie;
    if (process.env.NODE_ENV === 'production') {
        // In productie o cheie publica (din cod) ar permite falsificarea token-urilor.
        throw new Error('JWT_SECRET lipseste sau are sub 32 de caractere.');
    }
    return CHEIE_DEZVOLTARE;
}

let cheieCodificata: Uint8Array | null = null;

export function getJwtSecret(): Uint8Array {
    if (!cheieCodificata) {
        cheieCodificata = new TextEncoder().encode(cheieSecreta());
    }
    return cheieCodificata;
}
