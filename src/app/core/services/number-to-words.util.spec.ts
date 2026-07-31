import { numberToWords } from './number-to-words.util';

describe('numberToWords (total en letras)', () => {
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
