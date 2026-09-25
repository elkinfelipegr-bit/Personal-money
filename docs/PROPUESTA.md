# Propuesta: app de seguimiento de gastos e ingresos

## La idea original
1. Identificar **cada vez que gastas algo**.
2. Decirle **por voz** (u otra forma) en qué fue.
3. Registrar también los **ingresos**.
4. Ver fácil el **balance**.

## ¿Se puede? Sí, con un matiz importante

| Parte | ¿Se puede? | Cómo |
|---|---|---|
| Registrar por voz | ✅ Sí | Reconocimiento de voz del propio navegador/teléfono (gratis, sin servidores). |
| Entender la frase | ✅ Sí | Intérprete en español hecho a medida: monto, tipo, categoría, fecha, medio de pago. |
| Ingresos y balance | ✅ Sí | Mismo registro; el balance se calcula por mes. |
| **Detectar solo cada gasto** | ⚠️ Parcial | Una app no puede «ver» tus pagos por sí misma. Los bancos en Colombia no tienen API abierta para personas. Las formas reales son leer los **correos o SMS de notificación del banco** (fase 2) o conectarse con un agregador financiero de pago (Belvo, Prometeo). |

## Cambio de estructura que recomiendo

Tu idea parte de «la app detecta el gasto y luego yo le digo en qué fue». Propongo invertirlo al comienzo:

**Fase 1 — Tú lo dices, la app hace el resto (lo que ya está construido).**
Registrar hablando toma ~5 segundos y funciona con *cualquier* forma de pago, incluido el efectivo, que ningún banco reporta. Lo clave para que el hábito se mantenga es que sea más rápido que abrir una hoja de cálculo, y que puedas corregir antes de guardar.

**Fase 2 — La app te avisa de lo que se te olvidó.**
Leer las notificaciones del banco (por ejemplo, los correos de Bancolombia/Nequi/Davivienda «Compraste $X en Y») y dejarlas como *pendientes por clasificar*. Así se cumple tu idea original, pero como red de seguridad, no como única fuente, porque los correos no cubren efectivo y el formato cambia por banco.

**Fase 3 — Inteligencia.** Presupuestos por categoría con alertas, gastos recurrentes (arriendo, Netflix), y usar un modelo de IA para entender frases complejas («pagué 80 mil de luz y 60 de internet» → dos movimientos).

## Opciones que evalué

| Opción | Ventajas | Desventajas | Veredicto |
|---|---|---|---|
| **App web instalable (PWA)** | Gratis, sin tiendas, funciona en iPhone y Android, voz incluida, sin servidor, se publica en GitHub Pages | Los datos viven en el teléfono (hay respaldo manual) | ✅ **Elegida para empezar** |
| App nativa (Flutter/React Native) | Acceso a SMS en Android, notificaciones | Mucho más trabajo, publicar en tiendas cuesta, iPhone no permite leer SMS | Más adelante, si la fase 2 lo pide |
| Bot de Telegram/WhatsApp | Mandas nota de voz desde el chat | Necesita servidor 24/7 y transcripción de pago; WhatsApp Business cobra | Buena alternativa, no como base |
| Google Sheets + Asistente | Muy rápido de montar | Frágil, poco amigable en el celular | ❌ |

## Decisiones de diseño
- **Confirmar antes de guardar:** la voz se equivoca con números; ver «$25.000 · Comida» antes de guardar evita datos basura.
- **Privacidad por defecto:** todo local; nada de cuentas ni contraseñas del banco.
- **Sin dependencias ni compilación:** HTML/CSS/JS puro, fácil de modificar y de mantener años.
- **Categorías editables** en `src/categories.js`, pensadas para Colombia (Éxito, D1, TransMilenio, Nequi, EPM…).
- **El guardado está aislado** en `src/storage.js`: cuando quieras sincronizar entre dispositivos (Supabase/Firebase), solo se cambia ese archivo.

## Estado

- [x] Fase 1: registro por voz o texto, balance, resumen, respaldo.
- [x] Fase 2: lector de avisos bancarios, bandeja «Por revisar», sin duplicados, compartir a la app y automatización con Atajos de iPhone.
- [x] Fase 3: varios movimientos en una frase, presupuestos con alertas, gastos/ingresos fijos, tendencia de 6 meses.

## Ideas para después
- Sincronizar entre dispositivos (Supabase o Firebase); hoy los datos viven en un solo teléfono.
- Leer los correos del banco automáticamente (requiere un pequeño servidor o Google Apps Script con tu permiso).
- Usar un modelo de IA para frases muy libres; hoy todo es local, gratis y sin enviar datos a terceros.
- Metas de ahorro.
