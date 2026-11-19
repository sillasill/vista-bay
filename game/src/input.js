// Keyboard and mouse input. Held keys are read every fixed step; one-shot
// presses (confirm, pause, enter car, punch, jump) are queued as bit flags and
// taken once by the loop, so a press between two frames is never lost or
// counted twice. Mouse movement feeds a third-person camera; a click on the
// canvas requests pointer lock while playing.
export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_ENTER = 4;
export const ACTION_PUNCH = 8;
export const ACTION_JUMP = 16;

const FORWARD = new Set(['KeyW', 'ArrowUp']);
const BACK = new Set(['KeyS', 'ArrowDown']);
const LEFT = new Set(['KeyA', 'ArrowLeft']);
const RIGHT = new Set(['KeyD', 'ArrowRight']);
const SPRINT = new Set(['ShiftLeft', 'ShiftRight']);
const CONFIRM = new Set(['Enter']);
const PAUSE = new Set(['KeyP', 'Escape']);
const ENTER = new Set(['KeyE']);
const PUNCH = new Set(['KeyF']);
const JUMP = new Set(['Space']);

export function createInput(canvas) {
  const keys = new Set();
  let actions = 0;
  let mouseDX = 0;
  let mouseDY = 0;
  let mouseDown = false;
  let locked = false;

  window.addEventListener('keydown', (event) => {
    if (event.repeat) {
      if (FORWARD.has(event.code) || BACK.has(event.code) || LEFT.has(event.code) || RIGHT.has(event.code)) event.preventDefault();
      return;
    }
    keys.add(event.code);
    if (CONFIRM.has(event.code)) actions |= ACTION_CONFIRM;
    else if (PAUSE.has(event.code)) actions |= ACTION_PAUSE;
    else if (ENTER.has(event.code)) actions |= ACTION_ENTER;
    else if (PUNCH.has(event.code)) actions |= ACTION_PUNCH;
    else if (JUMP.has(event.code)) actions |= ACTION_JUMP;
    if (FORWARD.has(event.code) || BACK.has(event.code) || LEFT.has(event.code) || RIGHT.has(event.code) || JUMP.has(event.code)) {
      event.preventDefault();
    }
  });
  window.addEventListener('keyup', (event) => {
    keys.delete(event.code);
  });
  window.addEventListener('blur', () => {
    keys.clear();
    mouseDown = false;
  });
  document.addEventListener('pointerlockchange', () => {
    locked = document.pointerLockElement === canvas;
  });
  document.addEventListener('mousemove', (event) => {
    if (!locked) return;
    mouseDX += event.movementX || 0;
    mouseDY += event.movementY || 0;
  });
  canvas.addEventListener('mousedown', (event) => {
    if (event.button === 0) mouseDown = true;
  });
  window.addEventListener('mouseup', (event) => {
    if (event.button === 0) mouseDown = false;
  });
  canvas.addEventListener('click', () => {
    if (!locked && document.pointerLockElement !== canvas) {
      try {
        canvas.requestPointerLock();
      } catch {
        // Pointer lock is a nicety; the game still plays with arrow keys.
      }
    }
  });

  const has = (set) => {
    for (const code of set) if (keys.has(code)) return true;
    return false;
  };

  return {
    /** Forward/back strafe as -1, 0 or 1 each: W/S and A/D. */
    move() {
      const f = (has(FORWARD) ? 1 : 0) - (has(BACK) ? 1 : 0);
      const s = (has(RIGHT) ? 1 : 0) - (has(LEFT) ? 1 : 0);
      return { f, s };
    },
    sprint() {
      return has(SPRINT);
    },
    /** Is the left mouse button held (shooting)? */
    shooting() {
      return mouseDown;
    },
    /** Mouse movement since the last call, in pixels. */
    takeMouse() {
      const out = { dx: mouseDX, dy: mouseDY };
      mouseDX = 0;
      mouseDY = 0;
      return out;
    },
    /** The one-shot presses since the last call, as ACTION_* flags. */
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
    /** Is the pointer locked to the canvas right now? */
    isLocked() {
      return locked;
    },
    /** Release pointer lock (menus do this). */
    unlock() {
      if (document.pointerLockElement) document.exitPointerLock();
    },
  };
}
