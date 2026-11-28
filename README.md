# reference-explorer

**Turn a reference catalog into an interactive, searchable tool map.**

A reusable Web Component and JavaScript module. Your host owns the data; the component renders it.

## Highlights

- Purpose-based overview, relationship maps, and searchable tool lists.
- Expandable plugins and subcommands, driven by catalog metadata.
- Host-controlled styling with light/dark modes and CSS design tokens.
- No dedicated backend or build step required for the CDN integration.

## Quick start

```html
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@clang.engineer/reference-explorer/src/styles/explorer.css">
<reference-explorer
  src="https://raw.githubusercontent.com/clang-engineer/devkit/main/reference/catalog.json"
  default-view="map">
</reference-explorer>
<script type="module" src="https://cdn.jsdelivr.net/npm/@clang.engineer/reference-explorer/src/element.js"></script>
```

For JavaScript projects:

```sh
npm install @clang.engineer/reference-explorer
```

## Explore

- [Devkit catalog](https://github.com/clang-engineer/devkit)
- [Local examples](examples/) — run `python3 -m http.server 8000` from the repository root.
- [Integration manual](docs/manual.md) — JavaScript API, styling, catalog structure, and development.
