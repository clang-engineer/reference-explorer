# @clang-engineer/reference-explorer

A small Web Component and ES module for rendering reference catalog data as a searchable graph/list explorer.

The package does not own data. Hosts provide either a catalog URL, a catalog object, or a prebuilt explorer model.

## Web Component

```html
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@clang-engineer/reference-explorer/src/styles/explorer.css">

<reference-explorer
  src="https://raw.githubusercontent.com/clang-engineer/devkit/main/reference/catalog.json"
  default-view="map">
</reference-explorer>

<script type="module" src="https://cdn.jsdelivr.net/npm/@clang-engineer/reference-explorer/src/element.js"></script>
```

## JavaScript API

```js
import { mount } from '@clang-engineer/reference-explorer';
import '@clang-engineer/reference-explorer/style.css';

mount(document.querySelector('[data-reference-explorer]'), {
  catalogUrl: 'https://raw.githubusercontent.com/clang-engineer/devkit/main/reference/catalog.json',
});
```

## Devkit adapter

```js
import { mount } from '@clang-engineer/reference-explorer';
import { fromDevkitCatalog } from '@clang-engineer/reference-explorer/adapters/devkit';

const catalog = await fetch(url).then(response => response.json());
mount(root, { model: fromDevkitCatalog(catalog) });
```
