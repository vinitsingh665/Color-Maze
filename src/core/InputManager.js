/**
 * InputManager — Keyboard + Touch/Swipe input handling
 */

export class InputManager {
  constructor() {
    this.onDirection = null; // callback(direction)
    this.enabled = false;
    this._touchStartX = 0;
    this._touchStartY = 0;
    this._minSwipe = 30;

    this._handleKeyDown = this._handleKeyDown.bind(this);
    this._handleTouchStart = this._handleTouchStart.bind(this);
    this._handleTouchEnd = this._handleTouchEnd.bind(this);

    window.addEventListener("keydown", this._handleKeyDown);
    window.addEventListener("touchstart", this._handleTouchStart, { passive: false });
    window.addEventListener("touchend", this._handleTouchEnd, { passive: false });
  }

  enable() {
    this.enabled = true;
  }

  disable() {
    this.enabled = false;
  }

  _handleKeyDown(e) {
    if (!this.enabled || !this.onDirection) return;

    const keyMap = {
      ArrowUp: "up",
      ArrowDown: "down",
      ArrowLeft: "left",
      ArrowRight: "right",
      w: "up",
      W: "up",
      s: "down",
      S: "down",
      a: "left",
      A: "left",
      d: "right",
      D: "right",
    };

    const direction = keyMap[e.key];
    if (direction) {
      e.preventDefault();
      this.onDirection(direction);
    }
  }

  _handleTouchStart(e) {
    if (!this.enabled) return;
    const touch = e.touches[0];
    this._touchStartX = touch.clientX;
    this._touchStartY = touch.clientY;
  }

  _handleTouchEnd(e) {
    if (!this.enabled || !this.onDirection) return;
    const touch = e.changedTouches[0];
    const dx = touch.clientX - this._touchStartX;
    const dy = touch.clientY - this._touchStartY;

    if (Math.abs(dx) < this._minSwipe && Math.abs(dy) < this._minSwipe) return;

    if (Math.abs(dx) > Math.abs(dy)) {
      this.onDirection(dx > 0 ? "right" : "left");
    } else {
      this.onDirection(dy > 0 ? "down" : "up");
    }
  }

  destroy() {
    window.removeEventListener("keydown", this._handleKeyDown);
    window.removeEventListener("touchstart", this._handleTouchStart);
    window.removeEventListener("touchend", this._handleTouchEnd);
  }
}
