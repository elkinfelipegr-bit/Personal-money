import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseTransaction, parseDigitToken } from '../src/parser.js';

const NOW = new Date(2026, 8, 25, 12, 0, 0); // 25 sep 2026
const parse = (text) => parseTransaction(text, NOW);

test('cifras con separadores', () => {
  assert.equal(parseDigitToken('25.000'), 25000);
  assert.equal(parseDigitToken('1.500.000'), 1500000);
  assert.equal(parseDigitToken('25,000'), 25000);
  assert.equal(parseDigitToken('1,5'), 1.5);
  assert.equal(parseDigitToken('12.50'), 12.5);
  assert.equal(parseDigitToken('$8000'), 8000);
  assert.equal(parseDigitToken('abc'), null);
});

const cases = [
  ['gasté 25 mil en almuerzo', { type: 'expense', amount: 25000, category: 'comida', description: 'Almuerzo' }],
  ['Gasté 25.000 en el almuerzo con mi novia', { amount: 25000, category: 'comida', description: 'Almuerzo con mi novia' }],
  ['almuerzo 18000', { type: 'expense', amount: 18000, category: 'comida', description: 'Almuerzo' }],
  ['taxi 12k', { amount: 12000, category: 'transporte', description: 'Taxi' }],
  ['uber $15.500', { amount: 15500, category: 'transporte' }],
  ['pagué el arriendo 1,2 millones', { type: 'expense', amount: 1200000, category: 'hogar', description: 'Arriendo' }],
  ['me pagaron la quincena 1.800.000', { type: 'income', amount: 1800000, category: 'salario', description: 'Quincena' }],
  ['recibí 500 mil de un cliente', { type: 'income', amount: 500000, category: 'freelance', description: 'Cliente' }],
  ['me consignaron el sueldo, 3 millones', { type: 'income', amount: 3000000, category: 'salario' }],
  ['vendí la bicicleta en 350 mil', { type: 'income', amount: 350000, category: 'ventas', description: 'Bicicleta' }],
  ['compré unos tenis de 200 mil con tarjeta de crédito', { type: 'expense', amount: 200000, category: 'compras', description: 'Tenis', paymentMethod: 'credito' }],
  ['pagué la tarjeta de crédito 400 mil', { amount: 400000, category: 'deudas', paymentMethod: null }],
  ['mercado en el éxito 230 mil por nequi', { amount: 230000, category: 'mercado', paymentMethod: 'nequi' }],
  ['treinta y cinco mil de gasolina', { amount: 35000, category: 'transporte', description: 'Gasolina' }],
  ['un millón y medio de la prima', { type: 'income', amount: 1500000, category: 'salario' }],
  ['compré un helado de 5 mil', { amount: 5000, category: 'comida', description: 'Helado' }],
  ['2 empanadas por 6 mil', { amount: 6000, category: 'comida' }],
  ['netflix 44.900', { amount: 44900, category: 'suscripciones' }],
  ['20 lucas de cerveza', { amount: 20000, category: 'entretenimiento' }],
  ['dos palos del carro', { amount: 2000000, category: 'transporte' }],
  ['pagué el salario de la empleada 1.300.000', { type: 'expense', amount: 1300000 }],
  ['recibo de la luz 95 mil', { type: 'expense', amount: 95000, category: 'servicios' }],
  ['cosas varias', { amount: null, category: 'otros', description: 'Cosas varias' }],
];

for (const [text, expected] of cases) {
  test(`"${text}"`, () => {
    const result = parse(text);
    for (const [key, value] of Object.entries(expected)) {
      assert.equal(result[key], value, `${key} de "${text}": ${JSON.stringify(result)}`);
    }
  });
}

test('fechas relativas', () => {
  assert.equal(parse('taxi 10 mil').date, '2026-09-25');
  assert.equal(parse('ayer gasté 10 mil en taxi').date, '2026-09-24');
  assert.equal(parse('antier 10 mil de pan').date, '2026-09-23');
  assert.equal(parse('antes de ayer 10 mil de pan').date, '2026-09-23');
  assert.equal(parse('ayer gasté 10 mil en taxi').description, 'Taxi');
});
