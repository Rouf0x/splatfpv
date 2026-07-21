// Guided controller calibration — center, then sweep throttle/yaw/pitch/roll
// one at a time. Auto-detects which raw axis is which and its real range,
// so the user never has to know which gp.axes[N] their hardware uses.

const STEPS = [
  {
    action: 'throttle',
    title: 'Throttle',
    instruction: 'Move the THROTTLE through its full range a few times, then leave it at idle (minimum), then click Continue.',
  },
  {
    action: 'yaw',
    title: 'Yaw',
    instruction: 'Move the YAW stick fully left and right a few times, then let it re-center, then click Continue.',
  },
  {
    action: 'pitch',
    title: 'Pitch',
    instruction: 'Move the PITCH stick fully forward and back a few times, then let it re-center, then click Continue.',
  },
  {
    action: 'roll',
    title: 'Roll',
    instruction: 'Move the ROLL stick fully left and right a few times, then let it re-center, then click Continue.',
  },
];

const MIN_DEVIATION = 0.15;
const NUM_CHANNELS = 8;

export function initCalibrationWizard(input, settingsStore) {
  let overlay = null;
  let phase = 'intro'; // intro | center | step | summary
  let stepIndex = -1;
  let centers = null;
  let claimed = new Set();
  let assignments = []; // { index, action, min, center, max }
  let rafId = null;

  function el(id) { return overlay.querySelector(`#${id}`); }

  function build() {
    overlay = document.createElement('div');
    overlay.id = 'calWizard';
    overlay.innerHTML = `
      <div class="load-card" style="width:min(480px,92vw)">
        <span class="card-corner tl"></span><span class="card-corner tr"></span>
        <span class="card-corner bl"></span><span class="card-corner br"></span>
        <div class="load-header">
          <div class="logo-mark">
            <svg viewBox="0 0 32 32" width="26" height="26" fill="none" stroke="currentColor" stroke-width="1.7">
              <line x1="6.5" y1="6.5" x2="25.5" y2="25.5"/>
              <line x1="25.5" y1="6.5" x2="6.5" y2="25.5"/>
              <circle cx="6.5" cy="6.5" r="3.4"/>
              <circle cx="25.5" cy="6.5" r="3.4"/>
              <circle cx="6.5" cy="25.5" r="3.4"/>
              <circle cx="25.5" cy="25.5" r="3.4"/>
              <circle cx="16" cy="16" r="1.8" fill="currentColor" stroke="none"/>
            </svg>
          </div>
          <div>
            <h1 id="calTitle">Calibrate controller</h1>
            <p class="sub" id="calInstruction"></p>
          </div>
        </div>
        <div id="calSteps" class="cal-steps"></div>
        <div id="calLive" class="load-status" style="color:var(--osd-dim)"></div>
        <div class="demo-row">
          <button id="calCancel" class="btn ghost">Cancel</button>
          <button id="calNext" class="btn primary">Start</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    el('calCancel').addEventListener('click', close);
    el('calNext').addEventListener('click', advance);
  }

  function renderSteps() {
    el('calSteps').innerHTML = STEPS.map((_, i) => {
      let cls = 'dot';
      if (phase === 'summary' || i < stepIndex) cls += ' done';
      else if (phase === 'step' && i === stepIndex) cls += ' active';
      return `<span class="${cls}"></span>`;
    }).join('');
  }

  function render() {
    renderSteps();
    if (phase === 'intro') {
      el('calTitle').textContent = 'Calibrate controller';
      el('calInstruction').textContent = 'Connect your controller, then click Start. You will be asked to center, then sweep throttle, yaw, pitch and roll one at a time.';
      el('calNext').textContent = 'Start';
    } else if (phase === 'center') {
      el('calTitle').textContent = 'Center';
      el('calInstruction').textContent = 'Leave every stick and the throttle at rest, then click Continue.';
      el('calNext').textContent = 'Continue';
    } else if (phase === 'step') {
      const s = STEPS[stepIndex];
      el('calTitle').textContent = `${s.title} (${stepIndex + 1}/${STEPS.length})`;
      el('calInstruction').textContent = s.instruction;
      el('calNext').textContent = stepIndex === STEPS.length - 1 ? 'Finish' : 'Continue';
    } else if (phase === 'summary') {
      el('calTitle').textContent = 'Done';
      const lines = assignments.length
        ? assignments.map((a) => `Axis ${a.index} → ${a.action}`).join('<br>')
        : 'Nothing detected — try again with the controller connected.';
      const skipped = STEPS.map((s) => s.action).filter((a) => !assignments.some((x) => x.action === a));
      const skippedLine = skipped.length ? `<br>Not detected: ${skipped.join(', ')}` : '';
      el('calInstruction').innerHTML = `${lines}${skippedLine}`;
      el('calNext').textContent = 'Save & close';
    }
  }

  function tick() {
    if (!overlay) return;
    const gp = input.readGamepad();
    const liveEl = el('calLive');
    if (!gp) {
      liveEl.textContent = 'No controller detected — move a stick or press a button on it';
    } else {
      liveEl.textContent = Array.from(gp.axes).map((v, i) => `Ax${i}:${v.toFixed(2)}`).join('  ');
    }
    rafId = requestAnimationFrame(tick);
  }

  function pickBestAxis(rangeResult) {
    let bestIdx = -1;
    let bestDeviation = MIN_DEVIATION;
    for (let i = 0; i < NUM_CHANNELS; i++) {
      if (claimed.has(i)) continue;
      const { min, max } = rangeResult;
      if (!Number.isFinite(min[i]) || !Number.isFinite(max[i])) continue;
      const c = centers[i] ?? 0;
      const deviation = Math.max(Math.abs(max[i] - c), Math.abs(min[i] - c));
      if (deviation > bestDeviation) {
        bestDeviation = deviation;
        bestIdx = i;
      }
    }
    return bestIdx;
  }

  function advance() {
    if (phase === 'intro') {
      if (!input.readGamepad()) return; // stay on intro until a controller is seen
      phase = 'center';
      render();
      return;
    }

    if (phase === 'center') {
      const gp = input.readGamepad();
      centers = input.captureCenter(gp) || new Array(NUM_CHANNELS).fill(0);
      claimed = new Set();
      assignments = [];
      stepIndex = 0;
      input.startRangeCapture();
      phase = 'step';
      render();
      return;
    }

    if (phase === 'step') {
      const result = input.stopRangeCapture();
      if (result) {
        const idx = pickBestAxis(result);
        if (idx !== -1) {
          const action = STEPS[stepIndex].action;
          claimed.add(idx);
          const min = result.min[idx];
          const max = result.max[idx];
          // Throttle always maps min..max linearly to 0%..100%, using the
          // midpoint of the SWEPT range as center — not the earlier resting
          // reading. That makes it correct either way: a friction-held stick
          // (idle sits at one end of its travel) or a spring-centered stick
          // (idle sits in the middle, full -1..1 sweep used for 0..100%).
          const center = action === 'throttle' ? (min + max) / 2 : (centers[idx] ?? 0);
          assignments.push({ index: idx, action, min, center, max });
        }
      }

      if (stepIndex < STEPS.length - 1) {
        stepIndex += 1;
        input.startRangeCapture();
        render();
      } else {
        save();
        phase = 'summary';
        render();
      }
      return;
    }

    if (phase === 'summary') {
      close();
    }
  }

  function save() {
    const channels = Array.from({ length: NUM_CHANNELS }, () => ({ action: 'none', min: -1, center: 0, max: 1 }));
    assignments.forEach((a) => {
      channels[a.index] = { action: a.action, min: a.min, center: a.center, max: a.max };
    });
    settingsStore.gamepad.channels = channels;
    settingsStore.gamepad.invert = { throttle: false, yaw: false, pitch: false, roll: false };
    settingsStore.save();
  }

  let onDone = null;

  function close() {
    if (rafId) cancelAnimationFrame(rafId);
    rafId = null;
    if (overlay) {
      overlay.remove();
      overlay = null;
    }
    const cb = onDone;
    onDone = null;
    cb?.();
  }

  // `done` fires once, whether the user finishes calibration or cancels —
  // used to gate entering flight until the wizard has been dismissed.
  function open(done) {
    if (overlay) return;
    onDone = done || null;
    phase = 'intro';
    stepIndex = -1;
    build();
    render();
    tick();
  }

  return { open, close };
}
