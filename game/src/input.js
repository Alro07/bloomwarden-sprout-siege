// BLOOMWARDEN — Sprout Siege: keyboard and mouse input, in garden coordinates.
// The canvas is a fixed 1280x720 field scaled to the window; mouse positions are
// mapped back into that field. pressed() reports a key's edge (down this frame).
export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.keys = new Set();
    this.pressedKeys = new Set();
    this.mouseX = 640;
    this.mouseY = 300;
    this.mouseDown = false;
    this.clicked = false;
    this.clickX = 0;
    this.clickY = 0;

    window.addEventListener('keydown', (event) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(event.code)) {
        event.preventDefault();
      }
      if (!event.repeat) this.pressedKeys.add(event.code);
      this.keys.add(event.code);
    });
    window.addEventListener('keyup', (event) => {
      this.keys.delete(event.code);
    });
    window.addEventListener('blur', () => {
      this.keys.clear();
      this.mouseDown = false;
    });
    canvas.addEventListener('mousemove', (event) => {
      const rect = canvas.getBoundingClientRect();
      this.mouseX = ((event.clientX - rect.left) / rect.width) * 1280;
      this.mouseY = ((event.clientY - rect.top) / rect.height) * 720;
    });
    canvas.addEventListener('mousedown', (event) => {
      if (event.button === 0) this.mouseDown = true;
    });
    window.addEventListener('mouseup', (event) => {
      if (event.button === 0) this.mouseDown = false;
    });
    canvas.addEventListener('click', (event) => {
      const rect = canvas.getBoundingClientRect();
      this.clickX = ((event.clientX - rect.left) / rect.width) * 1280;
      this.clickY = ((event.clientY - rect.top) / rect.height) * 720;
      this.clicked = true;
    });
  }

  down(code) {
    return this.keys.has(code);
  }

  pressed(code) {
    return this.pressedKeys.has(code);
  }

  /** WASD or arrow-key movement, normalised. */
  moveVector() {
    let x = 0;
    let y = 0;
    if (this.down('KeyA') || this.down('ArrowLeft')) x -= 1;
    if (this.down('KeyD') || this.down('ArrowRight')) x += 1;
    if (this.down('KeyW') || this.down('ArrowUp')) y -= 1;
    if (this.down('KeyS') || this.down('ArrowDown')) y += 1;
    const len = Math.hypot(x, y) || 1;
    return { x: x / len, y: y / len };
  }

  /** Clear the edge-triggered state; called once per frame by the main loop. */
  endFrame() {
    this.pressedKeys.clear();
    this.clicked = false;
  }
}
