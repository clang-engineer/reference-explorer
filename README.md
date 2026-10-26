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

The catalog owns classification. `tool_map.domains` defines navigation groups; each category declares its stable `id`, `domain`, optional `aliases` and `tags`. The component does not merge or reclassify categories by name. Generic catalogs without taxonomy metadata remain visible in a fallback group.

Commands may declare `tool_id` independently of their executable/display name. `hosts`, `section` and `tags` describe a command's membership in its category; `kind`, `role` and `platforms` describe the tool. Cheatsheet records join the same tool via `tool_id` or `slug`. Catalog authors should register every tool in a purpose category instead of relying on a document shelf as its classification.

Tags filter tools and registered relations, while search remains global. Category and domain aliases preserve old links. No hidden mapping of known category, tool, language or host names is applied.

Plugins and configurations with explicit `hosts` are folded under that host. Use the host's **+N** control to expand them below it. The surrounding dotted box indicates containment, not a dependency/alternative relationship. Tag links reveal matching extensions automatically, and explicit search shows extensions directly. Missing hosts never hide tools. Role labels and section names are supplied by the catalog.

Guide records are exposed as linked resources using their `related_tools` metadata; they do not inflate tool counts. The public model retains their source records.

The main explorer restores host expansion through the optional `hosts` hash parameter; each relationship modal keeps its own temporary expansion state. No source catalog membership or relationship is added when a host is shown as context for a plugin category.

## Purpose-based overview

The overview uses responsive purpose cards instead of a category-overlap graph.
Purpose cards show source subcategory headings with compact tool previews.
Expand each subcategory to see all its tools, or open its relationship map.
Hosts retain expandable plugins and subcommands with role sections and labels.
Expand/collapse-all controls apply to both subcategory previews and host children. Existing `overview=macro` links now open the tool overview.

Navigation groups follow the catalog's domain names, order and category membership.
Renaming a category or registering a new domain does not require component code changes.
The catalog, rather than UI overrides, places standalone configuration tools and
other tools into their purpose categories.

The terminal palette follows explicit `html[data-mode]` choices and the system
color scheme when the host has no explicit mode, including live mode changes.

## Devkit adapter

```js
import { mount } from '@clang.engineer/reference-explorer';
import { fromDevkitCatalog } from '@clang.engineer/reference-explorer/adapters/devkit';

const catalog = await fetch(url).then(response => response.json());
mount(root, { model: fromDevkitCatalog(catalog) });
```
