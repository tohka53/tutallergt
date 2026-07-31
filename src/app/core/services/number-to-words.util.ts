/**
 * Convierte un monto a letras en español, formato factura Guatemala.
 * Ej: 1234.50 -> "UN MIL DOSCIENTOS TREINTA Y CUATRO QUETZALES CON 50/100"
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

export function numberToWords(amount: number): string {
  const rounded = Math.round(amount * 100) / 100;
  const integer = Math.floor(rounded);
  const cents = Math.round((rounded - integer) * 100);

  let text: string;
  if (integer === 0) {
    text = 'CERO';
  } else {
    const millions = Math.floor(integer / 1_000_000);
    const thousands = Math.floor((integer % 1_000_000) / 1000);
    const rest = integer % 1000;
    const parts: string[] = [];
    if (millions > 0) {
      parts.push(millions === 1 ? 'UN MILLON' : toWordsBelowThousand(millions) + ' MILLONES');
    }
    if (thousands > 0) {
      parts.push(thousands === 1 ? 'UN MIL' : toWordsBelowThousand(thousands) + ' MIL');
    }
    if (rest > 0) {
      parts.push(toWordsBelowThousand(rest));
    }
    text = parts.join(' ');
  }

  const centsStr = cents.toString().padStart(2, '0');
  return `${text} QUETZALES CON ${centsStr}/100`;
}
