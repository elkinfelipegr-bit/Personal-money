# Mi Plata 💸

App para llevar tus **gastos e ingresos hablándole al teléfono** y ver tu balance del mes.

> «gasté 25 mil en almuerzo» → **−$25.000 · Comida · Almuerzo · hoy**
> «me pagaron la quincena 1.800.000» → **+$1.800.000 · Salario**

## Cómo funciona

1. Tocas el micrófono (o escribes) y dices el movimiento con tus palabras.
2. La app entiende el **monto**, si es **gasto o ingreso**, la **categoría**, la **fecha** («ayer», «antier») y el **medio de pago** («con tarjeta», «por Nequi»).
3. Te muestra una tarjeta para **confirmar o corregir** antes de guardar (la voz a veces se equivoca, y esto evita datos malos).
4. En **Inicio** ves el balance del mes; en **Resumen**, en qué se te va la plata.

Entiende formas colombianas de hablar: `25 mil`, `25k`, `25.000`, `1,2 millones`, `un millón y medio`, `20 lucas`, `2 palos`, `treinta y cinco mil`.

### Lo que incluye

| Fase | Función |
|---|---|
| 1 | Registro por **voz o texto**, confirmación, balance mensual, lista, resumen por categoría y medio de pago, respaldo y CSV |
| 2 | **Avisos del banco**: pega SMS/notificaciones/correos (Bancolombia, Nequi, Davivienda, Daviplata, BBVA…) o compártelos a la app; quedan en **«Por revisar»** sin duplicados. En iPhone se puede automatizar con Atajos |
| 3 | **Varios movimientos en una frase** («80 mil de luz y 60 de internet»), **presupuestos** por categoría con alertas al 80 % y 100 %, **gastos/ingresos fijos** que aparecen solos cada mes, y **tendencia de 6 meses** |

## Usarla

- **En el celular:** abre la dirección de GitHub Pages (ver abajo) en Chrome (Android) o Safari (iPhone) y elige **«Agregar a pantalla de inicio»**. Queda como una app, funciona sin internet.
- **En tu computador:**
  ```bash
  npm start        # abre http://localhost:8080
  npm test         # pruebas del intérprete de frases
  ```
  No hay nada que instalar ni compilar: es HTML, CSS y JavaScript puro.

### Publicarla gratis con GitHub Pages
1. En GitHub: **Settings → Pages → Build and deployment → Source: GitHub Actions**.
2. Cada vez que se actualice la rama `main`, se publica sola en
   `https://elkinfelipegr-bit.github.io/Personal-money/`.

### Registrar sin abrir la app
La app acepta el texto en la dirección: `…/Personal-money/?text=gasté 20 mil en taxi`. Sirve tanto para frases como para avisos del banco.
- **Voz con Siri:** Atajo «Dictar texto» → «Abrir URL» con `?text=` + lo dictado. Dices *«Oye Siri, gasto»* y hablas.
- **Cada SMS del banco (iPhone):** Atajos → Automatización → Mensaje que contiene «Bancolombia» → Abrir URL con `?text=` + el mensaje.
- **Android:** en el SMS o notificación → Compartir → Mi Plata (con la app instalada). Para hacerlo automático, MacroDroid o Tasker.

Los pasos detallados están en **Ajustes** dentro de la app.

## Tus datos
Tus movimientos se guardan **solo en tu dispositivo**: no hay cuentas ni servidores. El dictado usa el reconocimiento de voz del teléfono (Google o Apple procesan el audio para convertirlo en texto), pero la app no guarda ni envía la grabación. Por eso en **Ajustes** puedes descargar un respaldo, restaurarlo en otro teléfono y exportar a Excel (CSV).

---

## Análisis de la idea y por qué se hizo así

Ver [`docs/PROPUESTA.md`](docs/PROPUESTA.md): qué es posible, qué no, las opciones que se evaluaron y el plan por fases.

## Estructura

```
index.html            Interfaz (4 pestañas + diálogo de confirmación)
styles.css            Estilos, modo claro/oscuro automático
src/parser.js         Entiende frases en español → uno o varios movimientos
src/bank.js           Lee avisos de bancos (SMS, notificaciones, correos)
src/planning.js       Presupuestos, gastos fijos y tendencia mensual
src/categories.js     Categorías y palabras clave (edítalas a tu gusto)
src/storage.js        Guardado local, respaldo y exportación CSV
src/speech.js         Reconocimiento de voz del navegador
src/app.js            Lógica de pantallas
sw.js                 Funcionamiento sin internet
tests/                Pruebas (frases, avisos del banco, presupuestos y fijos)
```
