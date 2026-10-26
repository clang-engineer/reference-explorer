import { canMoveNode, positionKey } from '../graph/manual-layout.js';

const boards = new WeakMap();
const stages = new WeakSet();

export function registerDraggableBoard(board, context) {
  boards.set(board, context);
}

// Delegate to the persistent stage: rendering replaces SVG nodes during a drag.
export function enableNodeDragging(stage) {
  if (!stage.addEventListener || stages.has(stage)) return;
  stages.add(stage);
  const window = stage.ownerDocument.defaultView;
  let drag = null, frame = 0, pending = null, suppressClick = false;
  function flush() {
    if (frame) window.cancelAnimationFrame(frame);
    frame = 0;
    if (!drag || !pending) return;
    const point = pending; pending = null;
    const { context, id } = drag;
    if (!canMoveNode(context.layout, id, point)) return;
    context.positions.set(positionKey(context.category, id), point);
    context.redraw();
  }
  stage.addEventListener('pointerdown', event => {
    if (event.button !== 0 || drag) return;
    const node = event.target.closest('.dk-node[data-tool]');
    const board = node?.closest('.dk-board');
    const context = boards.get(board);
    const svg = node?.ownerSVGElement;
    const matrix = svg?.getScreenCTM();
    if (!context || !matrix) return;
    suppressClick = false;
    drag = { context, id: node.dataset.tool, pointer: event.pointerId,
      inverse: matrix.inverse(), x: event.clientX, y: event.clientY,
      origin: { ...context.layout.positions.get(node.dataset.tool) }, moved: false,
      previous: context.positions.get(positionKey(context.category, node.dataset.tool)) };
    // Capture only after the drag threshold, so ordinary clicks still select.
  });
  stage.addEventListener('pointermove', event => {
    if (!drag || event.pointerId !== drag.pointer) return;
    if (!drag.moved && Math.hypot(event.clientX - drag.x, event.clientY - drag.y) < 5) return;
    if (!drag.moved) {
      drag.moved = true;
      stage.setPointerCapture(event.pointerId);
      stage.classList.add('is-node-dragging');
    }
    const start = new window.DOMPoint(drag.x, drag.y).matrixTransform(drag.inverse);
    const current = new window.DOMPoint(event.clientX, event.clientY).matrixTransform(drag.inverse);
    pending = { x: Math.max(16, drag.origin.x + current.x - start.x), y: Math.max(32, drag.origin.y + current.y - start.y) };
    if (!frame) frame = window.requestAnimationFrame(flush);
    event.preventDefault();
    event.stopPropagation();
  });
  function stop(event) {
    if (!drag || event.pointerId !== drag.pointer) return;
    const cancelled = event.type === 'pointercancel';
    if (cancelled) {
      pending = null;
      const key = positionKey(drag.context.category, drag.id);
      if (drag.previous) drag.context.positions.set(key, drag.previous);
      else drag.context.positions.delete(key);
      if (drag.moved) drag.context.redraw();
    } else flush();
    if (frame) window.cancelAnimationFrame(frame);
    frame = 0; pending = null;
    suppressClick = drag.moved;
    drag = null;
    stage.classList.remove('is-node-dragging');
    if (stage.hasPointerCapture(event.pointerId)) stage.releasePointerCapture(event.pointerId);
  }
  stage.addEventListener('pointerup', stop);
  stage.addEventListener('pointercancel', stop);
  stage.addEventListener('lostpointercapture', stop);
  stage.addEventListener('pointerleave', () => { if (drag && !drag.moved) drag = null; });
  stage.addEventListener('click', event => {
    if (!suppressClick) return;
    suppressClick = false;
    event.preventDefault(); event.stopImmediatePropagation();
  }, true);
}
