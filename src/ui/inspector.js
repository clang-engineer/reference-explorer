// Responsive presentation only. The detail content and its requests have one owner.
export function createInspector(root, panel, { onClose, signal }) {
  const document = root.ownerDocument;
  const window = document.defaultView;
  const host = root.querySelector('[data-panel-host]');
  const dialog = root.querySelector('[data-detail-dialog]');
  let opened = false;
  let previousFocus;
  let previousOverflow;
  function closeModal() {
    if (dialog.open) dialog.close();
    if (previousOverflow !== undefined) {
      document.body.style.overflow = previousOverflow;
      previousOverflow = undefined;
    }
  }
  function sync() {
    if (!opened) return;
    const narrow = root.clientWidth < 1050 && typeof dialog.showModal === 'function';
    root.dataset.detailOpen = String(!narrow);
    host.hidden = narrow;
    if (narrow) {
      if (panel.parentElement !== dialog) dialog.append(panel);
      if (!dialog.open) {
        previousOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        dialog.showModal();
      }
    } else {
      closeModal();
      if (panel.parentElement !== host) host.append(panel);
    }
  }
  dialog.addEventListener('cancel', event => { event.preventDefault(); onClose(); }, { signal });
  dialog.addEventListener('click', event => {
    if (event.target !== dialog) return;
    const rect = dialog.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) onClose();
  }, { signal });
  const observer = window.ResizeObserver ? new window.ResizeObserver(sync) : null;
  observer?.observe(root);
  return {
    show() {
      if (!opened) previousFocus = document.activeElement;
      opened = true;
      sync();
    },
    hide({ focus = true } = {}) {
      opened = false;
      closeModal();
      host.hidden = true;
      root.dataset.detailOpen = 'false';
      if (panel.parentElement !== host) host.append(panel);
      if (focus) {
        const selected = root.querySelector('[data-tool].is-selected');
        const target = selected || (previousFocus?.isConnected && previousFocus.getClientRects?.().length ? previousFocus : root.querySelector('[data-search]'));
        target?.focus({ preventScroll: true });
      }
    },
    sync,
    destroy() {
      opened = false;
      observer?.disconnect();
      closeModal();
    },
  };
}
