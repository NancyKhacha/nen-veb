// Переходы по адресу после #: #/segodnya, #/rebyonok/dnevnik, #/statya/abc.
// Каждая вкладка отдаёт свои экраны списком { path: '/rebyonok/rost', view, tab, strip }.
import { useState, useEffect } from './lib.js?v=22';
import { track } from './stats.js?v=22';

const routes = [];
export function addRoutes(list) { routes.push(...list); }

export function current() {
  const h = location.hash.replace(/^#/, '') || '/';
  const [path, q] = h.split('?');
  return { path, query: Object.fromEntries(new URLSearchParams(q || '')) };
}

// Шаблон '/statya/:id' → { id }
export function match(path) {
  for (const r of routes) {
    const a = r.path.split('/'), b = path.split('/');
    if (a.length !== b.length) continue;
    const params = {};
    let ok = true;
    for (let i = 0; i < a.length; i++) {
      if (a[i].startsWith(':')) params[a[i].slice(1)] = decodeURIComponent(b[i]);
      else if (a[i] !== b[i]) { ok = false; break; }
    }
    if (ok) return { route: r, params };
  }
  return null;
}

let depth = 0;
export function go(path, { replace = false } = {}) {
  const url = '#' + path;
  if (replace) location.replace(url);
  else { depth += 1; location.hash = path; }
}
export function back(fallback = '/segodnya') {
  if (depth > 0) { depth -= 1; history.back(); }
  else go(fallback, { replace: true });
}

export function useRoute() {
  const [r, setR] = useState(current());
  useEffect(() => {
    const on = () => {
      const next = current();
      track('экран:' + next.path.split('/').slice(0, 3).join('/'));
      setR(next);
    };
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return r;
}
