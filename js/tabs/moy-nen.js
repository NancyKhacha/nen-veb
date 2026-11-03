// Вкладка «Мой НЭН» — заготовка, экраны собираются по Фигме.
import { html } from '../lib.js';
import { Header } from '../ui.js';

function Home() {
  return html`<div class="screen"><${Header} /><p class="lead">«Мой НЭН» собирается.</p></div>`;
}

export const routes = [
  { path: '/moy-nen', view: Home, tab: '/moy-nen', strip: true, night: false },
];

export function searchItems() { return []; }
