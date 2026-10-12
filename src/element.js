import { mount } from './ui/explorer.js';

const observed = ['src', 'default-view'];

export class ReferenceExplorerElement extends HTMLElement {
  static get observedAttributes() { return observed; }

  connectedCallback() {
    this.#mount();
  }

  disconnectedCallback() {
    this.#api?.destroy();
    this.#api = null;
  }

  attributeChangedCallback() {
    if (!this.isConnected) return;
    this.#api?.destroy();
    this.#api = null;
    this.#mount();
  }

  #api = null;

  #mount() {
    if (this.#api) return;
    this.#api = mount(this, {
      catalogUrl: this.getAttribute('src'),
      defaultView: this.getAttribute('default-view') || undefined,
    });
  }
}

if (!customElements.get('reference-explorer')) {
  customElements.define('reference-explorer', ReferenceExplorerElement);
}
