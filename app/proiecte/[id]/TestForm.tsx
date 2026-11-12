'use client';

import { useState } from 'react';
import { ActionForm, SubmitButton } from '@/components/forms';
import { inputCls } from '@/components/ui';
import { LABEL_TEST } from '@/lib/roluri';
import { getTestConfig } from '@/lib/ui';
import { inregistreazaTest } from './actions';

const OPTIUNI = ['VERDE', 'GALBEN', 'ROSU', 'NEGRU'] as const;

export interface TintaTest {
    componentaId?: number;
    plansaId?: number;
    tag: string;
    descriere?: string;
    pozitie?: { x: number; y: number; w: number; h: number };
}

/** Formular de semnare a unui test la rece (status + observatii). */
export default function TestForm({ tinta, compact = false }: { tinta: TintaTest; compact?: boolean }) {
    const [status, setStatus] = useState<string>('VERDE');

    return (
        <ActionForm action={inregistreazaTest} reseteaza onSucces={() => setStatus('VERDE')} className="space-y-2.5">
            {tinta.componentaId ? (
                <input type="hidden" name="componenta_id" value={tinta.componentaId} />
            ) : (
                <>
                    <input type="hidden" name="plansa_id" value={tinta.plansaId} />
                    <input type="hidden" name="tag_echipament" value={tinta.tag} />
                    <input type="hidden" name="descriere_tip" value={tinta.descriere ?? ''} />
                    {tinta.pozitie && (
                        <>
                            <input type="hidden" name="pos_x" value={tinta.pozitie.x} />
                            <input type="hidden" name="pos_y" value={tinta.pozitie.y} />
                            <input type="hidden" name="latime" value={tinta.pozitie.w} />
                            <input type="hidden" name="inaltime" value={tinta.pozitie.h} />
                        </>
                    )}
                </>
            )}
            <fieldset className="grid grid-cols-2 gap-1.5">
                <legend className="sr-only">Rezultat test</legend>
                {OPTIUNI.map((o) => {
                    const cfg = getTestConfig(o);
                    const activ = status === o;
                    return (
                        <label
                            key={o}
                            className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg border text-[11px] font-semibold cursor-pointer transition-all ${
                                activ ? `${cfg.badge} ring-1 ring-current scale-[1.02]` : 'border-[#EEEEEE]/10 text-[#EEEEEE]/60 hover:border-[#EEEEEE]/30'
                            }`}
                        >
                            <input type="radio" name="status_test" value={o} checked={activ} onChange={() => setStatus(o)} className="sr-only" />
                            <span className="w-2.5 h-2.5 rounded-full border border-white/20" style={{ background: cfg.stroke }} />
                            {LABEL_TEST[o]}
                        </label>
                    );
                })}
            </fieldset>
            <textarea
                name="observatii"
                rows={compact ? 2 : 3}
                maxLength={1000}
                placeholder={status === 'ROSU' || status === 'NEGRU' ? 'Descrie defectul (obligatoriu)...' : 'Masuratori, observatii (optional)...'}
                required={status === 'ROSU' || status === 'NEGRU'}
                className={inputCls}
            />
            <SubmitButton className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-[#FFD369] hover:bg-[#ffdc85] text-[#222831] rounded-xl text-xs font-bold transition-all disabled:opacity-50 cursor-pointer" textAsteptare="Se semneaza...">
                Semneaza testul {tinta.tag}
            </SubmitButton>
        </ActionForm>
    );
}
