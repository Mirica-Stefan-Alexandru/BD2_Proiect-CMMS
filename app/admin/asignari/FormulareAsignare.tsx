'use client';

import { useState } from 'react';
import { ActionForm, SubmitButton } from '@/components/forms';
import { btnPericol, btnPrimar, inputCls } from '@/components/ui';
import { ROLURI_IN_PROIECT, rolInProiectPotrivit } from '@/lib/roluri';
import { adaugaAsignare, modificaAsignare, stergeAsignare } from '@/app/admin/actions';

export interface AngajatOptiune {
    id: number;
    nume: string;
    rol: string;
    proiecteActive: number;
}

export function AdaugaMembruForm({ proiectId, angajati }: { proiectId: number; angajati: AngajatOptiune[] }) {
    const [utilizatorId, setUtilizatorId] = useState('');
    const selectat = angajati.find((a) => String(a.id) === utilizatorId);
    const roluri = Object.entries(ROLURI_IN_PROIECT).filter(
        ([cheie]) => !selectat || rolInProiectPotrivit(cheie, selectat.rol)
    );

    if (angajati.length === 0) {
        return <p className="text-[11px] text-[#EEEEEE]/50 italic">Toti angajatii activi fac deja parte din echipa.</p>;
    }

    const grupuri = [
        { rol: 'INGINER', label: 'Ingineri' },
        { rol: 'OPERATOR', label: 'Operatori' },
        { rol: 'MANAGER', label: 'Manageri' },
    ];

    return (
        <ActionForm action={adaugaAsignare} reseteaza onSucces={() => setUtilizatorId('')} className="space-y-2">
            <input type="hidden" name="proiect_id" value={proiectId} />
            <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-2">
                <select
                    name="utilizator_id"
                    required
                    value={utilizatorId}
                    onChange={(e) => setUtilizatorId(e.target.value)}
                    className={inputCls}
                    aria-label="Angajat"
                >
                    <option value="">Alege angajatul...</option>
                    {grupuri.map((g) => {
                        const lista = angajati.filter((a) => a.rol === g.rol);
                        if (lista.length === 0) return null;
                        return (
                            <optgroup key={g.rol} label={g.label}>
                                {lista.map((a) => (
                                    <option key={a.id} value={a.id}>
                                        {a.nume} - {a.proiecteActive} proiecte active
                                    </option>
                                ))}
                            </optgroup>
                        );
                    })}
                </select>
                <select name="rol_in_proiect" required className={inputCls} aria-label="Rol in proiect" disabled={!selectat}>
                    {roluri.map(([cheie, def]) => (
                        <option key={cheie} value={cheie}>
                            {def.label}
                        </option>
                    ))}
                </select>
                <SubmitButton className={btnPrimar} textAsteptare="Se asigneaza...">
                    + Asigneaza
                </SubmitButton>
            </div>
            {selectat && (
                <p className="text-[10px] text-[#EEEEEE]/50">
                    Roluri disponibile pentru un {selectat.rol.toLowerCase()}: {roluri.map(([, d]) => d.label).join(', ')}.
                </p>
            )}
        </ActionForm>
    );
}

export function RolAsignareForm({
    id,
    rolCurent,
    rolSistem,
}: {
    id: number;
    rolCurent: string;
    rolSistem: string;
}) {
    const optiuni = Object.entries(ROLURI_IN_PROIECT).filter(
        ([cheie]) => cheie === rolCurent || rolInProiectPotrivit(cheie, rolSistem)
    );
    return (
        <ActionForm action={modificaAsignare} className="min-w-0">
            <input type="hidden" name="id" value={id} />
            <select
                name="rol_in_proiect"
                defaultValue={rolCurent}
                aria-label="Rol in proiect"
                onChange={(e) => e.currentTarget.form?.requestSubmit()}
                className={`${inputCls} py-1.5! text-[11px]!`}
            >
                {optiuni.map(([cheie, def]) => (
                    <option key={cheie} value={cheie}>
                        {def.label}
                        {!rolInProiectPotrivit(cheie, rolSistem) ? ' (nepotrivit)' : ''}
                    </option>
                ))}
            </select>
        </ActionForm>
    );
}

export function StergeAsignareForm({ id, nume }: { id: number; nume: string }) {
    return (
        <ActionForm action={stergeAsignare} confirmare={`Scoti pe ${nume} din echipa proiectului?`}>
            <input type="hidden" name="id" value={id} />
            <SubmitButton className={`${btnPericol} px-2.5! py-1.5!`} title={`Scoate ${nume} din echipa`}>
                ✕
            </SubmitButton>
        </ActionForm>
    );
}
