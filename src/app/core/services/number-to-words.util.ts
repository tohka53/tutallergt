/**
 * Monto a letras, en español de Guatemala.
 *
 * Dos formatos, porque no se usan igual:
 *  - numberToWords: estilo factura, todo en mayúsculas y con los centavos
 *    como fracción: "UN MIL DOSCIENTOS TREINTA Y CUATRO QUETZALES CON 50/100".
 *  - amountInWords: el que va en la cotización de Mundo Garage, tal como está
 *    en el formato de papel: "Mil Sesenta Quetzales Exactos".
 */
const UNIDADES = ['', 'UNO', 'DOS', 'TRES', 'CUATRO', 'CINCO', 'SEIS', 'SIETE', 'OCHO', 'NUEVE'];
const ESPECIALES: Record<number, string> = {
  10: 'DIEZ', 11: 'ONCE', 12: 'DOCE', 13: 'TRECE', 14: 'CATORCE', 15: 'QUINCE',
  16: 'DIECISEIS', 17: 'DIECISIETE', 18: 'DIECIOCHO', 19: 'DIECINUEVE',
  20: 'VEINTE', 21: 'VEINTIUNO', 22: 'VEINTIDOS', 23: 'VEINTITRES',
  24: 'VEINTICUATRO', 25: 'VEINTICINCO', 26: 'VEINTISEIS', 27: 'VEINTISIETE',
  28: 'VEINTIOCHO', 29: 'VEINTINUEVE',
};
const DECENAS = ['', '', 'VEINTE', 'TREINTA', 'CUARENTA', 'CINCUENTA', 'SESENTA', 'SETENTA', 'OCHENTA', 'NOVENTA'];
const CENTENAS = ['', 'CIENTO', 'DOSCIENTOS', 'TRESCIENTOS', 'CUATROCIENTOS', 'QUINIENTOS',
  'SEISCIENTOS', 'SETECIENTOS', 'OCHOCIENTOS', 'NOVECIENTOS'];

function toWordsBelowThousand(n: number): string {
  if (n === 0) { return ''; }
  if (n === 100) { return 'CIEN'; }
  let words = '';
  const c = Math.floor(n / 100);
  const rest = n % 100;
  if (c > 0) { words += CENTENAS[c] + ' '; }
  if (rest > 0) {
    if (rest < 10) {
      words += UNIDADES[rest];
    } else if (rest < 30) {
      words += ESPECIALES[rest];
    } else {
      const d = Math.floor(rest / 10);
      const u = rest % 10;
      words += DECENAS[d] + (u > 0 ? ' Y ' + UNIDADES[u] : '');
    }
  }
  return words.trim();
}

/**
 * Parte entera en letras.
 * `unMil` decide entre "UN MIL" (estilo factura) y "MIL" (estilo cotización).
 */
function integerToWords(integer: number, unMil: boolean): string {
  if (integer === 0) { return 'CERO'; }
  const millions = Math.floor(integer / 1_000_000);
  const thousands = Math.floor((integer % 1_000_000) / 1000);
  const rest = integer % 1000;
  const parts: string[] = [];
  if (millions > 0) {
    parts.push(millions === 1 ? 'UN MILLON' : toWordsBelowThousand(millions) + ' MILLONES');
  }
  if (thousands > 0) {
    if (thousands === 1) {
      parts.push(unMil ? 'UN MIL' : 'MIL');
    } else {
      parts.push(toWordsBelowThousand(thousands) + ' MIL');
    }
  }
  if (rest > 0) { parts.push(toWordsBelowThousand(rest)); }
  return parts.join(' ');
}

/** Estilo factura: "UN MIL DOSCIENTOS QUETZALES CON 50/100". */
export function numberToWords(amount: number): string {
  const rounded = Math.round(amount * 100) / 100;
  const integer = Math.floor(rounded);
  const cents = Math.round((rounded - integer) * 100);
  const centsStr = cents.toString().padStart(2, '0');
  return `${integerToWords(integer, true)} QUETZALES CON ${centsStr}/100`;
}

/** Cada palabra con la inicial en mayúscula: "Mil Sesenta Quetzales". */
function titleCase(text: string): string {
  return text
    .toLowerCase()
    .split(' ')
    .map((w) => (w ? w.charAt(0).toUpperCase() + w.slice(1) : w))
    .join(' ');
}

/**
 * Estilo de la cotización en papel de Mundo Garage:
 * "Mil Sesenta Quetzales Exactos" · "Mil Sesenta Quetzales con 50/100".
 */
export function amountInWords(amount: number): string {
  const rounded = Math.round(amount * 100) / 100;
  const integer = Math.floor(rounded);
  const cents = Math.round((rounded - integer) * 100);
  const base = titleCase(integerToWords(integer, false)) + ' Quetzales';
  return cents === 0 ? `${base} Exactos` : `${base} con ${cents.toString().padStart(2, '0')}/100`;
}
