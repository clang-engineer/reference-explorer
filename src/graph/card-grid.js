// Card width is an input to graph layout, never an output of SVG dimensions.
export function cardGrid(availableWidth, count, { minWidth = 360, maxWidth = 480, gap = 16 } = {}) {
  const available = Math.max(170, availableWidth);
  const columns = Math.max(1, Math.min(3, count || 1, Math.floor((available + gap) / (minWidth + gap))));
  const width = Math.min(maxWidth, (available - gap * (columns - 1)) / columns);
  return { columns, width, graphWidth: width - 2 };
}

export function watchMapWidth(stage, redraw, signal) {
  const window = stage.ownerDocument.defaultView;
  if (!window.ResizeObserver) return;
  let width = stage.parentElement.clientWidth;
  let frame = 0;
  const observer = new window.ResizeObserver(() => {
    const next = stage.parentElement.clientWidth;
    if (next === width) return;
    width = next;
    if (frame) window.cancelAnimationFrame(frame);
    frame = window.requestAnimationFrame(() => {
      frame = 0;
      if (stage.classList.contains('is-relation-grid')) redraw();
    });
  });
  observer.observe(stage.parentElement);
  signal.addEventListener('abort', () => {
    observer.disconnect();
    if (frame) window.cancelAnimationFrame(frame);
  }, { once: true });
}
