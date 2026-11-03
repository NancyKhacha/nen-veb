// Вкладка «Сегодня» — заготовка, экраны собираются по Фигме.
import { html } from '../lib.js';
import { Header } from '../ui.js';

function Home() {
  return html`<div class="screen"><${Header} /><p class="lead">«Сегодня» собирается.</p></div>`;
}

export const routes = [
  { path: '/segodnya', view: Home, tab: '/segodnya', strip: true, night: true },
];

export function searchItems() { return []; }
