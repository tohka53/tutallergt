import { amountInWords, numberToWords } from './number-to-words.util';

describe('numberToWords (estilo factura)', () => {
  it('convierte enteros con centavos', () => {
    expect(numberToWords(1234.5)).toBe('UN MIL DOSCIENTOS TREINTA Y CUATRO QUETZALES CON 50/100');
  });
  it('maneja cero', () => {
    expect(numberToWords(0)).toBe('CERO QUETZALES CON 00/100');
  });
  it('maneja cien exacto', () => {
    expect(numberToWords(100)).toBe('CIEN QUETZALES CON 00/100');
  });
  it('maneja millones', () => {
    expect(numberToWords(1000000)).toBe('UN MILLON QUETZALES CON 00/100');
  });
});

describe('amountInWords (estilo cotización Mundo Garage)', () => {
  it('reproduce el ejemplo del formato en papel', () => {
    expect(amountInWords(1060)).toBe('Mil Sesenta Quetzales Exactos');
  });
  it('dice "Exactos" sólo cuando no hay centavos', () => {
    expect(amountInWords(1060.75)).toBe('Mil Sesenta Quetzales con 75/100');
  });
  it('no antepone "Un" a mil', () => {
    expect(amountInWords(1000)).toBe('Mil Quetzales Exactos');
  });
  it('sí lo hace a partir de dos mil', () => {
    expect(amountInWords(2500)).toBe('Dos Mil Quinientos Quetzales Exactos');
  });
});
