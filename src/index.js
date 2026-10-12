import { mount } from './ui/explorer.js';
export { mount };

const root = globalThis.document?.querySelector?.('[data-reference-explorer], [data-devkit]');
if (root) mount(root);
