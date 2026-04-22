'use client';

import { useEffect, useMemo, useState } from 'react';

import { getMullvadCountries, type MullvadCountry } from '@/actions/mullvad';

// ISO 3166-1 alpha-2 → nombre en español. Si falta, caemos al código en
// mayúsculas + count de relays, que sigue siendo informativo.
const COUNTRY_NAMES_ES: Record<string, string> = {
  ar: 'Argentina',
  au: 'Australia',
  at: 'Austria',
  be: 'Bélgica',
  br: 'Brasil',
  bg: 'Bulgaria',
  ca: 'Canadá',
  cl: 'Chile',
  co: 'Colombia',
  cz: 'Chequia',
  dk: 'Dinamarca',
  de: 'Alemania',
  ee: 'Estonia',
  es: 'España',
  fi: 'Finlandia',
  fr: 'Francia',
  gb: 'Reino Unido',
  gr: 'Grecia',
  hk: 'Hong Kong',
  hr: 'Croacia',
  hu: 'Hungría',
  id: 'Indonesia',
  ie: 'Irlanda',
  il: 'Israel',
  in: 'India',
  it: 'Italia',
  jp: 'Japón',
  kh: 'Camboya',
  lv: 'Letonia',
  md: 'Moldavia',
  mx: 'México',
  my: 'Malasia',
  nl: 'Países Bajos',
  no: 'Noruega',
  nz: 'Nueva Zelanda',
  pe: 'Perú',
  ph: 'Filipinas',
  pl: 'Polonia',
  pt: 'Portugal',
  ro: 'Rumania',
  rs: 'Serbia',
  se: 'Suecia',
  sg: 'Singapur',
  si: 'Eslovenia',
  sk: 'Eslovaquia',
  th: 'Tailandia',
  tr: 'Turquía',
  tw: 'Taiwán',
  ua: 'Ucrania',
  us: 'Estados Unidos',
  uy: 'Uruguay',
  za: 'Sudáfrica',
};

interface Props {
  slug: string;
  name: string; // form field name
  defaultValue?: string;
  required?: boolean;
  placeholder?: string;
  className?: string;
  includeAll?: boolean; // adds "any" option
}

export function MullvadCountryPicker({
  slug,
  name,
  defaultValue,
  required,
  placeholder = 'Seleccioná país de salida…',
  className,
  includeAll = false,
}: Props) {
  const [countries, setCountries] = useState<MullvadCountry[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancel = false;
    setLoading(true);
    getMullvadCountries(slug)
      .then((c) => {
        if (cancel) return;
        if (!c) {
          setErr('Mullvad hub no configurado');
          setCountries([]);
        } else {
          setCountries(c);
          setErr(null);
        }
      })
      .catch((e: unknown) => {
        if (cancel) return;
        setErr(e instanceof Error ? e.message : 'error');
        setCountries([]);
      })
      .finally(() => {
        if (!cancel) setLoading(false);
      });
    return () => {
      cancel = true;
    };
  }, [slug]);

  const options = useMemo(() => {
    if (!countries) return [];
    return [...countries].sort((a, b) => {
      const an = COUNTRY_NAMES_ES[a.code] ?? a.code;
      const bn = COUNTRY_NAMES_ES[b.code] ?? b.code;
      return an.localeCompare(bn, 'es');
    });
  }, [countries]);

  return (
    <div className={className}>
      <select
        name={name}
        defaultValue={defaultValue ?? ''}
        required={required && !includeAll}
        disabled={loading || !!err}
        className="bg-surface border-border text-fg focus:border-accent w-full rounded border px-2 py-1.5 font-mono text-xs focus:outline-none disabled:opacity-50"
      >
        <option value="" disabled={required && !includeAll}>
          {loading ? 'Cargando países…' : (err ?? placeholder)}
        </option>
        {includeAll && <option value="">Cualquier país (aleatorio)</option>}
        {options.map((c) => {
          const label = COUNTRY_NAMES_ES[c.code] ?? c.code.toUpperCase();
          return (
            <option key={c.code} value={c.code}>
              {label} · {c.relays} relays
            </option>
          );
        })}
      </select>
    </div>
  );
}
