// Categorías y palabras clave para clasificar movimientos automáticamente.
// Las palabras clave están en minúsculas y sin tildes; se comparan como
// prefijo de palabra ("almuerz" coincide con "almuerzo" y "almorzar" no).

export const EXPENSE_CATEGORIES = [
  {
    id: 'comida', name: 'Comida', icon: '🍽️',
    keywords: ['almuerz', 'almorz', 'desayun', 'cena', 'comida', 'comi', 'restaurante', 'corrientazo',
      'cafe', 'tinto', 'pan', 'panaderia', 'domicilio', 'rappi', 'ifood', 'pizza', 'hamburguesa',
      'perro caliente', 'empanada', 'arepa', 'onces', 'snack', 'helado', 'pollo', 'sushi', 'postre',
      'gaseosa', 'jugo', 'mecato', 'galletas'],
  },
  {
    id: 'mercado', name: 'Mercado', icon: '🛒',
    keywords: ['mercado', 'supermercado', 'exito', 'd1', 'ara', 'jumbo', 'olimpica', 'carulla',
      'makro', 'fruta', 'verdura', 'carne', 'huevos', 'leche', 'viveres', 'tienda'],
  },
  {
    id: 'transporte', name: 'Transporte', icon: '🚌',
    keywords: ['bus', 'buseta', 'taxi', 'uber', 'didi', 'cabify', 'indrive', 'picap', 'transmilenio',
      'sitp', 'metro', 'pasaje', 'gasolina', 'tanque', 'parqueadero', 'parqueo', 'peaje',
      'moto', 'carro', 'lavado', 'soat', 'tecnomecanica', 'vuelo', 'tiquete'],
  },
  {
    id: 'hogar', name: 'Hogar', icon: '🏠',
    keywords: ['arriendo', 'alquiler', 'renta', 'administracion', 'hipoteca', 'mueble', 'aseo',
      'detergente', 'ferreteria', 'reparacion', 'plomero', 'electrodomestico', 'empleada'],
  },
  {
    id: 'servicios', name: 'Servicios', icon: '💡',
    keywords: ['luz', 'energia', 'agua', 'gas', 'internet', 'celular', 'plan de datos', 'telefono',
      'recarga', 'claro', 'movistar', 'tigo', 'wom', 'epm', 'codensa', 'enel', 'recibo', 'factura'],
  },
  {
    id: 'suscripciones', name: 'Suscripciones', icon: '📺',
    keywords: ['netflix', 'spotify', 'disney', 'hbo', 'prime', 'youtube', 'icloud',
      'google one', 'chatgpt', 'claude', 'suscripcion', 'membresia', 'apple music', 'xbox', 'playstation'],
  },
  {
    id: 'salud', name: 'Salud', icon: '💊',
    keywords: ['medic', 'drogueria', 'farmacia', 'eps', 'cita', 'odontolog', 'dentista',
      'gimnasio', 'gym', 'examen', 'laboratorio', 'pastilla', 'vitamina', 'terapia', 'psicolog', 'optica', 'gafas'],
  },
  {
    id: 'entretenimiento', name: 'Entretenimiento', icon: '🎉',
    keywords: ['cine', 'pelicula', 'fiesta', 'cerveza', 'pola', 'trago', 'bar', 'discoteca',
      'concierto', 'boleta', 'juego', 'salida', 'rumba', 'paseo', 'viaje', 'hotel', 'teatro', 'partido'],
  },
  {
    id: 'compras', name: 'Compras', icon: '🛍️',
    keywords: ['ropa', 'zapato', 'tenis', 'camisa', 'camiseta', 'pantalon', 'jean', 'chaqueta',
      'regalo', 'amazon', 'mercadolibre', 'mercado libre', 'temu', 'shein', 'falabella', 'accesorio',
      'audifonos', 'computador', 'portatil', 'maquillaje', 'perfume', 'peluqueria', 'corte de pelo', 'barberia'],
  },
  {
    id: 'educacion', name: 'Educación', icon: '📚',
    keywords: ['curso', 'universidad', 'colegio', 'libro', 'matricula', 'semestre', 'clase',
      'udemy', 'platzi', 'coursera', 'fotocopia', 'cuaderno', 'utiles', 'pension'],
  },
  {
    id: 'deudas', name: 'Deudas y créditos', icon: '💳',
    keywords: ['cuota', 'prestamo', 'credito', 'deuda', 'intereses', 'abono', 'pago de tarjeta', 'tarjeta de credito'],
  },
  {
    id: 'mascotas', name: 'Mascotas', icon: '🐾',
    keywords: ['perro', 'gato', 'mascota', 'veterinari', 'concentrado', 'cuido', 'arena'],
  },
  { id: 'otros', name: 'Otros gastos', icon: '📦', keywords: [] },
];

export const INCOME_CATEGORIES = [
  {
    id: 'salario', name: 'Salario', icon: '💼',
    keywords: ['salario', 'sueldo', 'nomina', 'quincena', 'prima', 'cesantias', 'bonificacion', 'bono', 'liquidacion'],
  },
  {
    id: 'freelance', name: 'Trabajos extra', icon: '🧑‍💻',
    keywords: ['proyecto', 'cliente', 'honorario', 'freelance', 'asesoria', 'consultoria', 'trabajo', 'servicio'],
  },
  {
    id: 'ventas', name: 'Ventas', icon: '🏷️',
    keywords: ['venta', 'vendi', 'negocio'],
  },
  {
    id: 'inversiones', name: 'Inversiones', icon: '📈',
    keywords: ['interes', 'dividendo', 'rendimiento', 'cdt', 'inversion', 'arriendo'],
  },
  {
    id: 'regalos', name: 'Regalos', icon: '🎁',
    keywords: ['regalo', 'regalaron', 'me dieron', 'mesada'],
  },
  { id: 'otros_ingresos', name: 'Otros ingresos', icon: '💰', keywords: [] },
];

export const PAYMENT_METHODS = [
  { id: 'efectivo', name: 'Efectivo' },
  { id: 'debito', name: 'Tarjeta débito' },
  { id: 'credito', name: 'Tarjeta crédito' },
  { id: 'nequi', name: 'Nequi' },
  { id: 'daviplata', name: 'Daviplata' },
  { id: 'transferencia', name: 'Transferencia' },
];

export function categoriesFor(type) {
  return type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
}

export function findCategory(id) {
  return [...EXPENSE_CATEGORIES, ...INCOME_CATEGORIES].find((c) => c.id === id)
    ?? EXPENSE_CATEGORIES[EXPENSE_CATEGORIES.length - 1];
}

export function defaultCategory(type) {
  return type === 'income' ? 'otros_ingresos' : 'otros';
}
