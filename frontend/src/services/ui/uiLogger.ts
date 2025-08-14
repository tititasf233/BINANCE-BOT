export type UiLogLevel = 'debug' | 'info' | 'warn' | 'error';

const PREFIX = '[UI]';

function log(level: UiLogLevel, message: string, data?: any) {
  const time = new Date().toISOString();
  const payload = data !== undefined ? data : '';
  switch (level) {
    case 'debug':
      console.debug(`${PREFIX} ${time} ${message}`, payload);
      break;
    case 'info':
      console.info(`${PREFIX} ${time} ${message}`, payload);
      break;
    case 'warn':
      console.warn(`${PREFIX} ${time} ${message}`, payload);
      break;
    case 'error':
      console.error(`${PREFIX} ${time} ${message}`, payload);
      break;
  }
}

export const uiLogger = {
  debug: (msg: string, data?: any) => log('debug', msg, data),
  info: (msg: string, data?: any) => log('info', msg, data),
  warn: (msg: string, data?: any) => log('warn', msg, data),
  error: (msg: string, data?: any) => log('error', msg, data),
};

// Habilita instrumentação global de interações
export function enableGlobalUiInstrumentation() {
  if ((window as any).__uiInstrumentationEnabled) return;
  (window as any).__uiInstrumentationEnabled = true;

  document.addEventListener('click', (event) => {
    const target = event.target as HTMLElement;
    if (!target) return;
    const text = (target.textContent || '').trim().slice(0, 120);
    const tag = target.tagName;
    const id = target.id;
    const classes = (target as any).className;
    uiLogger.info('Click', { tag, id, classes, text });
  }, true);

  document.addEventListener('change', (event) => {
    const el = event.target as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;
    if (!el) return;
    const tag = el.tagName;
    const id = (el as any).id;
    const name = (el as any).name;
    const type = (el as any).type;
    const value = (el as any).value;
    const checked = (el as any).checked;
    uiLogger.debug('Change', { tag, id, name, type, value, checked });
  }, true);

  document.addEventListener('submit', (event) => {
    const form = event.target as HTMLFormElement;
    const id = form?.id;
    const classes = form?.className;
    uiLogger.info('Submit', { id, classes, action: form?.action, method: form?.method });
  }, true);

  // Interceptar fetch para logs de UI também
  const originalFetch = window.fetch.bind(window);
  window.fetch = async (...args: any[]) => {
    const [input, init] = args;
    const method = init?.method || 'GET';
    const url = typeof input === 'string' ? input : input?.url;
    const reqId = Math.random().toString(36).slice(2, 10);
    uiLogger.debug('Fetch start', { reqId, method, url });
    const start = performance.now();
    try {
      const resp = await originalFetch(...args);
      const dur = Math.round(performance.now() - start);
      uiLogger.info('Fetch end', { reqId, method, url, status: resp.status, ms: dur });
      return resp;
    } catch (err) {
      const dur = Math.round(performance.now() - start);
      uiLogger.error('Fetch error', { reqId, method, url, ms: dur, error: String(err) });
      throw err;
    }
  };
}


