export class InputController {
  constructor(canvas) {
    this.canvas = canvas;
    this.keys = new Set();
    this.pressed = new Set();
    this.pointer = { x: 0, y: 0, down: false, inside: false };
    this.disposed = false;
    this.onKeyDown = (event) => {
      const key = event.key.toLowerCase();
      if ([' ', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(key)) event.preventDefault();
      if (!this.keys.has(key)) this.pressed.add(key);
      this.keys.add(key);
    };
    this.onKeyUp = (event) => this.keys.delete(event.key.toLowerCase());
    this.onBlur = () => { this.keys.clear(); this.pointer.down = false; };
    this.onPointerMove = (event) => {
      const rect = this.canvas.getBoundingClientRect();
      this.pointer.x = event.clientX - rect.left;
      this.pointer.y = event.clientY - rect.top;
      this.pointer.inside = this.pointer.x >= 0 && this.pointer.y >= 0 && this.pointer.x <= rect.width && this.pointer.y <= rect.height;
    };
    this.onPointerDown = (event) => {
      if (event.button === 0) this.pointer.down = true;
      this.canvas.focus?.({ preventScroll: true });
    };
    this.onPointerUp = (event) => { if (event.button === 0) this.pointer.down = false; };
    this.onContextMenu = (event) => event.preventDefault();
    window.addEventListener('keydown', this.onKeyDown, { passive: false });
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.onBlur);
    this.canvas.addEventListener('pointermove', this.onPointerMove);
    this.canvas.addEventListener('pointerdown', this.onPointerDown);
    window.addEventListener('pointerup', this.onPointerUp);
    this.canvas.addEventListener('contextmenu', this.onContextMenu);
  }

  down(...keys) { return keys.some(key => this.keys.has(key)); }
  justPressed(...keys) {
    const found = keys.some(key => this.pressed.has(key));
    if (found) keys.forEach(key => this.pressed.delete(key));
    return found;
  }
  consumeFrame() { this.pressed.clear(); }
  get movement() {
    return {
      x: Number(this.down('d', 'arrowright')) - Number(this.down('a', 'arrowleft')),
      z: Number(this.down('s', 'arrowdown')) - Number(this.down('w', 'arrowup'))
    };
  }
  get dashPressed() { return this.justPressed(' ', 'shift'); }
  get specialPressed() { return this.justPressed('e'); }
  get pausePressed() { return this.justPressed('escape', 'p'); }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('blur', this.onBlur);
    this.canvas.removeEventListener('pointermove', this.onPointerMove);
    this.canvas.removeEventListener('pointerdown', this.onPointerDown);
    window.removeEventListener('pointerup', this.onPointerUp);
    this.canvas.removeEventListener('contextmenu', this.onContextMenu);
  }
}
