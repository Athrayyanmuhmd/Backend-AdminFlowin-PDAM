/**
 * parseFlexDate — canonical date parser untuk semua input tanggal dari sistem eksternal.
 *
 * Menangani tiga format:
 *  1. ISO string: "2024-04-15T10:31:24.000Z"
 *  2. Epoch-ms number: 1713178684000
 *  3. Epoch-ms string: "1713178684000"
 *
 * Return null jika tidak dapat di-parse (JANGAN simpan Invalid Date ke database).
 *
 * Lihat: docs/INTEGRATION_FIELD_MAPPING.md#date-parsing-rules
 */
export function parseFlexDate(val: string | number | null | undefined): Date | null {
  if (val === null || val === undefined || val === '') return null;

  // Epoch-ms number
  if (typeof val === 'number') {
    if (!isFinite(val)) return null;
    return new Date(val);
  }

  // Epoch-ms string (semua digit)
  if (/^\d+$/.test(String(val))) {
    const num = Number(val);
    return isFinite(num) ? new Date(num) : null;
  }

  // ISO string atau format Date lain
  const d = new Date(val as string);
  return isNaN(d.getTime()) ? null : d;
}

/**
 * Validasi dan parse tanggal dari input API eksternal.
 * Melempar Error dengan pesan yang jelas jika tanggal tidak valid.
 *
 * @param val   - nilai input
 * @param field - nama field untuk pesan error
 */
export function requireFlexDate(val: string | number | null | undefined, field: string): Date {
  const d = parseFlexDate(val);
  if (!d) throw new Error(`Field "${field}" tidak berisi tanggal yang valid: ${JSON.stringify(val)}`);
  return d;
}

/**
 * Format tanggal ke string lokal Indonesia (DD/MM/YYYY HH:mm WIB).
 * Aman terhadap null — return '-' jika tanggal tidak ada.
 */
export function formatTanggalIndo(val: string | number | Date | null | undefined): string {
  if (!val) return '-';
  const d = val instanceof Date ? val : parseFlexDate(val as string | number | null | undefined);
  if (!d) return '-';
  return d.toLocaleString('id-ID', {
    timeZone: 'Asia/Jakarta',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
