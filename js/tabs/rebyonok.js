// Вкладка «Ребёнок» — заготовка, экраны собираются по Фигме.
import { html } from '../lib.js';
import { Header } from '../ui.js';

function Home() {
  return html`<div class="screen"><${Header} /><p class="lead">«Ребёнок» собирается.</p></div>`;
}

export const routes = [
  { path: '/rebyonok', view: Home, tab: '/rebyonok', strip: true, night: false },
];

export function searchItems() { return []; }
