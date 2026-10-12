import { buildModel } from '../core/catalog.js';

export function fromDevkitCatalog(catalog) {
  return buildModel(catalog);
}
