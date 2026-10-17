# @clang.engineer/reference-explorer

A small Web Component and ES module for rendering reference catalog data as a searchable graph/list explorer.

The package does not own data. Hosts provide either a catalog URL, a catalog object, or a prebuilt explorer model.

## Local preview

From the project root, start a static server (Python 3 required):

```sh
python3 -m http.server 8000
```

Open http://localhost:8000/examples/basic.html in your browser. No install or build step is required. The example loads its catalog from GitHub, so an internet connection is required.

Compare three visual concepts at http://localhost:8000/examples/concepts.html (technical documentation, developer workbench, and terminal). Preview styles are isolated from the default component.

Run tests with Node.js:

```sh
npm test
```

## Web Component

```html
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@clang.engineer/reference-explorer/src/styles/explorer.css">

<reference-explorer
  src="https://raw.githubusercontent.com/clang-engineer/devkit/main/reference/catalog.json"
  default-view="map">
</reference-explorer>

<script type="module" src="https://cdn.jsdelivr.net/npm/@clang.engineer/reference-explorer/src/element.js"></script>
```

## JavaScript API

```js
import { mount } from '@clang.engineer/reference-explorer';
import '@clang.engineer/reference-explorer/style.css';

mount(document.querySelector('[data-reference-explorer]'), {
  catalogUrl: 'https://raw.githubusercontent.com/clang-engineer/devkit/main/reference/catalog.json',
});
```

## Appearance

The default style is terminal-inspired: dark green, monospace typography, and square panels. Set `data-mode="light"` on the host `<html>` element to opt into a light palette; `data-mode="dark"` uses the default dark palette. The host controls its own page background and layout.

## Explorer classification

The explorer combines shell categories into **Shell**, editors/configurations/Neovim plugins into **Editors**, database tools/Neovim DB plugins into **Database**, and tmux plugins into **Terminal Multiplexer**. Original categories remain selectable filter tags; the devkit catalog and public model-building API are unchanged.

Tags filter both tools and relations registered in the corresponding original categories. **전체** clears the tag filter, and search remains global. Existing category names and IDs in links resolve to their merged category and matching tag.

Known plugins and configurations are folded under their host (Neovim, tmux, Zsh, or Emacs). Use the host's **+N** control to expand them below it. The surrounding dotted box indicates containment, not a dependency/alternative relationship. Tag filters reveal matching extensions automatically, and explicit search shows extensions directly. Unknown hosts are never guessed; those tools remain visible.

The main explorer restores host expansion through the optional `hosts` hash parameter; each relationship modal keeps its own temporary expansion state. No source catalog membership or relationship is added when a host is shown as context for a plugin category.

## Overview modes

Switch between **도구 탐색** (tool explorer) and **분류 관계도** (category overview) in the overview toolbar. The category overview connects categories that share tools; line weight reflects the number of shared tools, not alternative/complement relationships or learning order. Each category shows its tool count and internal relation count. Open **공통 도구 보기** to inspect shared tools, or select a category to open its detailed relationship map.

The catalog remains unchanged. `#scope=all&overview=macro` links directly to the category overview; existing links keep the tool explorer as their default.

## Devkit adapter

```js
import { mount } from '@clang.engineer/reference-explorer';
import { fromDevkitCatalog } from '@clang.engineer/reference-explorer/adapters/devkit';

const catalog = await fetch(url).then(response => response.json());
mount(root, { model: fromDevkitCatalog(catalog) });
```
