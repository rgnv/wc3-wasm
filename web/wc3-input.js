/* WC3 browser client input layer — touch (mobile) + gamepad (USB/Bluetooth).
 *
 * The engine consumes emscripten-SDL events; this module synthesizes the
 * matching DOM events (mouse/keyboard/wheel) so the engine needs no changes.
 *
 * Touch (auto on (pointer:coarse), ?touch=1 forces on, ?touch=0 forces off):
 *   tap               select (left click)
 *   long-press 450ms  command (right click)
 *   drag              pan camera (middle-button drag)
 *   two-finger tap    command (right click) at midpoint
 *   pinch             zoom (wheel)
 * Controller (Gamepad API — OS-paired USB or Bluetooth pads):
 *   left stick / d-pad   move cursor / pan camera
 *   A                    select (left click)
 *   B                    command (right click)
 *   L1 / R1              zoom out / in (wheel)
 *   L2 / R2              rotate camera (Insert / Delete)
 *   Start                menu (Escape)
 *   Back                 quests (F9)
 *   ?fakegamepad=1       test shim: window.fakeGamepad.set({axes:[],buttons:[]})
 */
(function () {
  'use strict';
  var params = new URLSearchParams(location.search);
  var canvas = document.getElementById('canvas');
  if (!canvas) return;
  var statusEl = document.getElementById('input-status');
  function setStatus(msg) { if (statusEl) statusEl.textContent = msg || ''; }

  /* ---------- synthesized DOM events ---------- */
  function dispatchMouse(type, x, y, button) {
    var buttons = type === 'mouseup' ? 0 : (button === 2 ? 2 : button === 1 ? 4 : 1);
    canvas.dispatchEvent(new MouseEvent(type, {
      bubbles: true, cancelable: true, view: window,
      clientX: x, clientY: y, button: button, buttons: buttons
    }));
  }
  function clickAt(x, y, button) {
    dispatchMouse('mousemove', x, y, 0);
    dispatchMouse('mousedown', x, y, button);
    dispatchMouse('mouseup', x, y, button);
  }
  function wheelAt(x, y, delta) {
    canvas.dispatchEvent(new WheelEvent('wheel', {
      bubbles: true, cancelable: true, view: window,
      clientX: x, clientY: y, deltaY: delta, deltaMode: 0
    }));
  }
  function keyEvent(code, key, down) {
    canvas.dispatchEvent(new KeyboardEvent(down ? 'keydown' : 'keyup', {
      bubbles: true, cancelable: true, view: window, code: code, key: key
    }));
  }

  /* ---------- touch ---------- */
  var coarse = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
  var touchOn = params.get('touch') === '1' || (coarse && params.get('touch') !== '0');
  var LONG_MS = 450, MOVE_THRESHOLD = 12, TAP_MS = 260;

  if (touchOn) {
    document.documentElement.classList.add('touch-mode');
    var pts = {};       // pointerId -> {x0,y0,x,y,t0,moved,longFired}
    var ids = [];
    var panning = false;
    var pinchDist = 0;
    var twoFingerTap = false;

    function rel(e) {
      var t = e.changedTouches ? e.changedTouches[0] : e;
      return { x: t.clientX, y: t.clientY };
    }
    function evPoint(e) { return rel(e); }

    canvas.addEventListener('touchstart', function (e) {
      e.preventDefault();
      for (var i = 0; i < e.changedTouches.length; i++) {
        var t = e.changedTouches[i];
        pts[t.identifier] = { x0: t.clientX, y0: t.clientY, x: t.clientX, y: t.clientY, t0: Date.now(), moved: false, longFired: false };
        ids.push(t.identifier);
      }
      if (ids.length === 2) {
        twoFingerTap = true;
        var a = pts[ids[0]], b = pts[ids[1]];
        pinchDist = Math.hypot(a.x - b.x, a.y - b.y);
        if (panning) { dispatchMouse('mouseup', a.x, a.y, 1); panning = false; }
      }
    }, { passive: false });

    canvas.addEventListener('touchmove', function (e) {
      e.preventDefault();
      for (var i = 0; i < e.changedTouches.length; i++) {
        var t = e.changedTouches[i];
        var p = pts[t.identifier];
        if (!p) continue;
        p.x = t.clientX; p.y = t.clientY;
        if (Math.hypot(p.x - p.x0, p.y - p.y0) > MOVE_THRESHOLD) p.moved = true;
      }
      if (ids.length === 2) {
        var a = pts[ids[0]], b = pts[ids[1]];
        if (a && b) {
          var d = Math.hypot(a.x - b.x, a.y - b.y);
          var mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
          if (Math.abs(d - pinchDist) > 18) {
            wheelAt(mid.x, mid.y, d > pinchDist ? -120 : 120);
            pinchDist = d;
            twoFingerTap = false;
          }
        }
      } else if (ids.length === 1) {
        var p0 = pts[ids[0]];
        if (p0 && p0.moved) {
          twoFingerTap = false;
          if (!panning) { dispatchMouse('mousedown', p0.x0, p0.y0, 1); panning = true; }
          dispatchMouse('mousemove', p0.x, p0.y, 1);
        }
      }
    }, { passive: false });

    function endTouch(e) {
      e.preventDefault();
      var finished = [];
      for (var i = 0; i < e.changedTouches.length; i++) {
        var t = e.changedTouches[i];
        var p = pts[t.identifier];
        if (p) finished.push(p);
        delete pts[t.identifier];
        ids = ids.filter(function (id) { return id !== t.identifier; });
      }
      if (panning && ids.length === 0) { dispatchMouse('mouseup', finished[0] ? finished[0].x : 0, finished[0] ? finished[0].y : 0, 1); panning = false; }
      if (e.type === 'touchcancel') { twoFingerTap = false; return; }
      if (twoFingerTap && ids.length === 0 && finished.length >= 1) {
        var p2 = finished[0];
        clickAt(p2.x, p2.y, 2);
        twoFingerTap = false;
        return;
      }
      if (ids.length === 0 && finished.length === 1) {
        var p = finished[0];
        var dt = Date.now() - p.t0;
        if (!p.moved && dt < TAP_MS && !p.longFired) clickAt(p.x, p.y, 0);
      }
    }
    canvas.addEventListener('touchend', endTouch, { passive: false });
    canvas.addEventListener('touchcancel', endTouch, { passive: false });

    /* long-press = right click */
    setInterval(function () {
      var now = Date.now();
      for (var k in pts) {
        var p = pts[k];
        if (!p.moved && !p.longFired && now - p.t0 >= LONG_MS) {
          p.longFired = true;
          clickAt(p.x, p.y, 2);
          if (navigator.vibrate) navigator.vibrate(15);
        }
      }
    }, 80);
    setStatus('Touch controls on — tap select · hold command · drag pan · 2-finger tap command');
  }

  /* ---------- gamepad (USB + Bluetooth via Gamepad API) ---------- */
  var padIndex = null;
  var cursor = null;
  var CURSOR_SPEED = 900;   // px/sec at full stick deflection
  var DEAD = 0.18, ROTATE_DEAD = 0.45;
  var prevButtons = [];

  function padStatus(pad) { setStatus('Controller: ' + (pad ? pad.id : '') + (pad ? ' — A select · B command · L1/R1 zoom · L2/R2 rotate · Start menu' : '')); }

  window.addEventListener('gamepadconnected', function (e) { padIndex = e.gamepad.index; padStatus(e.gamepad); });
  window.addEventListener('gamepaddisconnected', function (e) { if (padIndex === e.gamepad.index) { padIndex = null; padStatus(null); } });

  var lastT = performance.now();
  function btn(pad, n) { var b = pad.buttons[n]; return !!(b && (b.pressed || b.value > 0.5)); }

  function poll(now) {
    var dt = Math.min(0.05, (now - lastT) / 1000); lastT = now;
    var pads = navigator.getGamepads ? navigator.getGamepads() : [];
    var pad = null;
    if (padIndex !== null && pads && pads[padIndex]) pad = pads[padIndex];
    if (!pad) {
      for (var i = 0; i < (pads ? pads.length : 0); i++) if (pads[i]) { pad = pads[i]; padIndex = pad.index; padStatus(pad); break; }
    }
    if (pad) {
      var rect = canvas.getBoundingClientRect();
      if (!cursor) cursor = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
      var lx = pad.axes[0] || 0, ly = pad.axes[1] || 0;
      if (Math.abs(lx) > DEAD) cursor.x += lx * CURSOR_SPEED * dt;
      if (Math.abs(ly) > DEAD) cursor.y += ly * CURSOR_SPEED * dt;
      cursor.x = Math.max(rect.left + 2, Math.min(rect.right - 2, cursor.x));
      cursor.y = Math.max(rect.top + 2, Math.min(rect.bottom - 2, cursor.y));
      dispatchMouse('mousemove', cursor.x, cursor.y, 0);

      /* d-pad pans camera via arrows */
      var dp = [btn(pad, 12), btn(pad, 13), btn(pad, 14), btn(pad, 15)];
      var dpCodes = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];
      for (var d = 0; d < 4; d++) if (dp[d] !== !!prevButtons['dp' + d]) { keyEvent(dpCodes[d], dpCodes[d], dp[d]); prevButtons['dp' + d] = dp[d]; }

      /* face + shoulders */
      var b0 = btn(pad, 0), b1 = btn(pad, 1), l1 = btn(pad, 4), r1 = btn(pad, 5), l2 = btn(pad, 6), r2 = btn(pad, 7), start = btn(pad, 9), back = btn(pad, 8);
      if (b0 && !prevButtons.b0) clickAt(cursor.x, cursor.y, 0);
      if (b1 && !prevButtons.b1) clickAt(cursor.x, cursor.y, 2);
      if (r1 && !prevButtons.r1) wheelAt(cursor.x, cursor.y, -120);
      if (l1 && !prevButtons.l1) wheelAt(cursor.x, cursor.y, 120);
      if (r2 !== !!prevButtons.r2) keyEvent('Delete', 'Delete', r2);
      if (l2 !== !!prevButtons.l2) keyEvent('Insert', 'Insert', l2);
      if (start && !prevButtons.start) keyEvent('Escape', 'Escape', true), keyEvent('Escape', 'Escape', false);
      if (back && !prevButtons.back) keyEvent('F9', 'F9', true), keyEvent('F9', 'F9', false);
      prevButtons.b0 = b0; prevButtons.b1 = b1; prevButtons.l1 = l1; prevButtons.r1 = r1;
      prevButtons.l2 = l2; prevButtons.r2 = r2; prevButtons.start = start; prevButtons.back = back;
    }
    requestAnimationFrame(poll);
  }
  requestAnimationFrame(poll);

  /* ---------- fake gamepad test shim (inert unless ?fakegamepad=1) ---------- */
  if (params.get('fakegamepad') === '1') {
    var fakeState = { id: 'Fake BT Pad (test shim)', connected: true, mapping: 'standard',
      axes: [0, 0, 0, 0], buttons: Array.from({ length: 17 }, function () { return { pressed: false, value: 0 }; }) };
    var fakeGamepads = function () { var a = []; a[0] = fakeState; return a; };
    try { Object.defineProperty(navigator, 'getGamepads', { value: fakeGamepads, configurable: true }); } catch (e) {}
    window.fakeGamepad = {
      set: function (s) {
        if (s.axes) fakeState.axes = s.axes;
        if (s.buttons) for (var i = 0; i < s.buttons.length; i++) fakeState.buttons[i] = { pressed: !!s.buttons[i], value: s.buttons[i] ? 1 : 0 };
      }
    };
    setTimeout(function () { window.dispatchEvent(new Event('gamepadconnected')); }, 500);
  }
})();
