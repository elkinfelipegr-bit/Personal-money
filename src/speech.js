// Reconocimiento de voz del navegador (Web Speech API).
// Funciona en Chrome/Edge (Android, Windows, Mac) y Safari (iPhone/Mac).
// En navegadores sin soporte la app sigue funcionando con texto, y el
// micrófono del teclado del teléfono también sirve para dictar.

const Recognition = globalThis.SpeechRecognition || globalThis.webkitSpeechRecognition;

export const speechSupported = Boolean(Recognition);

/**
 * Escucha una frase. Llama a onInterim con el texto parcial mientras se habla
 * y resuelve con el texto final (o '' si no se entendió nada).
 */
export function listenOnce({ lang = 'es-CO', onInterim } = {}) {
  if (!Recognition) return { promise: Promise.reject(new Error('unsupported')), stop() {} };
  const rec = new Recognition();
  rec.lang = lang;
  rec.interimResults = true;
  rec.continuous = false;
  rec.maxAlternatives = 1;

  let finalText = '';
  const promise = new Promise((resolve, reject) => {
    rec.onresult = (event) => {
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const r = event.results[i];
        if (r.isFinal) finalText += r[0].transcript;
        else interim += r[0].transcript;
      }
      onInterim?.((finalText + interim).trim());
    };
    rec.onerror = (event) => {
      if (event.error === 'no-speech' || event.error === 'aborted') resolve('');
      else reject(new Error(event.error));
    };
    rec.onend = () => resolve(finalText.trim());
  });
  rec.start();
  return { promise, stop: () => rec.stop() };
}
