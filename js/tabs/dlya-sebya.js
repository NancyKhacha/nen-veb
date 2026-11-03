// Вкладка «Для себя» — заготовка, экраны собираются по Фигме.
import { html } from '../lib.js';
import { Header } from '../ui.js';

function Home() {
  return html`<div class="screen"><${Header} /><p class="lead">«Для себя» собирается.</p></div>`;
}

export const routes = [
  { path: '/dlya-sebya', view: Home, tab: '/dlya-sebya', strip: true, night: false },
];

export function searchItems() { return []; }
