'use client';

import { useEffect, useState, useCallback } from 'react';

const STORAGE_KEY = 'nexchain_imported_tokens_v2';
const OLD_STORAGE_KEY = 'nexchain_imported_tokens';

export type ImportedTokenMeta = {
  address: string;
  logo?: string;
};

export function useImportedTokens() {
  const [importedMeta, setImportedMeta] = useState<ImportedTokenMeta[]>([]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          setImportedMeta(parsed);
          return;
        }
      }
      // Migracion del formato viejo (solo strings)
      const oldRaw = localStorage.getItem(OLD_STORAGE_KEY);
      if (oldRaw) {
        const oldParsed = JSON.parse(oldRaw);
        if (Array.isArray(oldParsed)) {
          const migrated = oldParsed
            .filter((a) => typeof a === 'string')
            .map((a) => ({ address: a.toLowerCase() }));
          setImportedMeta(migrated);
          localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
        }
      }
    } catch {}
  }, []);

  const save = useCallback((next: ImportedTokenMeta[]) => {
    // Dedup por address
    const seen = new Set<string>();
    const dedup: ImportedTokenMeta[] = [];
    for (const item of next) {
      const key = item.address.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        dedup.push({ ...item, address: key });
      }
    }
    setImportedMeta(dedup);
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(dedup));
      } catch {}
    }
  }, []);

  const add = useCallback(
    (address: string, logo?: string) => {
      if (!/^0x[a-fA-F0-9]{40}$/.test(address)) return false;
      const newItem: ImportedTokenMeta = {
        address: address.toLowerCase(),
        ...(logo ? { logo } : {}),
      };
      save([...importedMeta, newItem]);
      return true;
    },
    [importedMeta, save]
  );

  const remove = useCallback(
    (address: string) => {
      save(importedMeta.filter((m) => m.address.toLowerCase() !== address.toLowerCase()));
    },
    [importedMeta, save]
  );

  const getLogo = useCallback(
    (address: string): string | undefined => {
      const found = importedMeta.find(
        (m) => m.address.toLowerCase() === address.toLowerCase()
      );
      return found?.logo;
    },
    [importedMeta]
  );

  // Devolvemos solo addresses para compatibilidad
  const imported = importedMeta.map((m) => m.address);

  return { imported, importedMeta, add, remove, getLogo };
}
