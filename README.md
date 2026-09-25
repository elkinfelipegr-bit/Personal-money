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

### Registrar sin abrir la app (atajo de voz)
La app acepta el texto en la dirección: `…/Personal-money/?q=gasté 20 mil en taxi`.
- **iPhone:** crea un Atajo «Dictar texto» → «Abrir URL» con `?q=` + el texto dictado. Luego dices *«Oye Siri, gasto»* y hablas.
- **Android:** igual con una rutina de Google Assistant o la app Atajos/Tasker.

## Tus datos
Se guardan **solo en tu dispositivo** (nada sale a internet, ni siquiera la voz se guarda). Por eso en **Ajustes** puedes descargar un respaldo, restaurarlo en otro teléfono y exportar a Excel (CSV).

---

## Análisis de la idea y por qué se hizo así

Ver [`docs/PROPUESTA.md`](docs/PROPUESTA.md): qué es posible, qué no, las opciones que se evaluaron y el plan por fases.

## Estructura

```
index.html            Interfaz (4 pestañas + diálogo de confirmación)
styles.css            Estilos, modo claro/oscuro automático
src/parser.js         Entiende frases en español → movimiento
src/categories.js     Categorías y palabras clave (edítalas a tu gusto)
src/storage.js        Guardado local, respaldo y exportación CSV
src/speech.js         Reconocimiento de voz del navegador
src/app.js            Lógica de pantallas
sw.js                 Funcionamiento sin internet
tests/                Pruebas del intérprete
```
