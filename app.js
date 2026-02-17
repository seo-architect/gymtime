const unlockBtn = document.getElementById("unlockBtn");
const pauseBtn = document.getElementById("pauseBtn");
const resetBtn = document.getElementById("resetBtn");
const toggleAllBeeps = document.getElementById("toggleAllBeeps");
const timersContainer = document.getElementById("timers");
const liveClockEl = document.getElementById("liveClock");

const timerConfig = [
  { id: "t30m", name: "30m", durationSeconds: 30 * 60, beepEnabled: true },
  { id: "t10m", name: "10m", durationSeconds: 10 * 60, beepEnabled: true },
  { id: "t5m", name: "5m", durationSeconds: 5 * 60, beepEnabled: true },
  { id: "t1m", name: "1m", durationSeconds: 60, beepEnabled: true },
  { id: "t30s", name: "30s", durationSeconds: 30, beepEnabled: true },
  { id: "t10s", name: "10s", durationSeconds: 10, beepEnabled: true },
];

let audioCtx = null;
let audioUnlocked = false;
let timersStarted = false;
let timersPaused = false;
let pausedElapsedMs = 0;
let tickHandle = null;
let startTimeMs = 0;

const timerState = timerConfig.map((t) => ({ ...t, lastCycleIndex: null }));

function formatHms(totalSeconds) {
  const safe = Math.max(0, totalSeconds);
  const h = String(Math.floor(safe / 3600)).padStart(2, "0");
  const m = String(Math.floor((safe % 3600) / 60)).padStart(2, "0");
  const s = String(safe % 60).padStart(2, "0");
  return `${h}:${m}:${s}`;
}

function renderTimers() {
  timersContainer.innerHTML = "";

  timerState.forEach((timer) => {
    const card = document.createElement("article");
    card.className = "timer";

    const head = document.createElement("div");
    head.className = "timer-head";

    const title = document.createElement("h2");
    title.textContent = timer.name;
    head.append(title);

    const remaining = document.createElement("p");
    remaining.className = "remaining";
    remaining.id = `${timer.id}-remaining`;
    remaining.textContent = "00:00:00";

    const beepToggle = document.createElement("label");
    beepToggle.className = "toggle";

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = timer.beepEnabled;
    checkbox.dataset.timerId = timer.id;
    checkbox.setAttribute("aria-label", `${timer.name} beep`);
    checkbox.addEventListener("change", (e) => {
      timer.beepEnabled = e.target.checked;
      toggleAllBeeps.checked = timerState.every((item) => item.beepEnabled);
    });

    const text = document.createElement("span");
    text.textContent = "Beep on loop";

    beepToggle.append(checkbox, text);
    card.append(head, remaining, beepToggle);
    timersContainer.append(card);
  });
}

function setAllBeeps(enabled) {
  timerState.forEach((timer) => {
    timer.beepEnabled = enabled;
  });

  const checkboxes = timersContainer.querySelectorAll('input[type="checkbox"][data-timer-id]');
  checkboxes.forEach((checkbox) => {
    checkbox.checked = enabled;
  });
}

function beep() {
  if (!audioUnlocked || !audioCtx || audioCtx.state !== "running") return;

  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();

  osc.type = "sine";
  osc.frequency.value = 880;
  gain.gain.value = 0.0001;

  osc.connect(gain);
  gain.connect(audioCtx.destination);

  const now = audioCtx.currentTime;
  gain.gain.exponentialRampToValueAtTime(0.2, now + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);

  osc.start(now);
  osc.stop(now + 0.2);
}

function updateLiveClock() {
  const now = new Date();
  const hours = String(now.getHours()).padStart(2, "0");
  const minutes = String(now.getMinutes()).padStart(2, "0");
  const seconds = String(now.getSeconds()).padStart(2, "0");
  liveClockEl.textContent = `${hours}:${minutes}:${seconds}`;
}

function updateTick(elapsedMs) {
  const elapsedSeconds = Math.floor(elapsedMs / 1000);

  timerState.forEach((timer) => {
    const cycleSeconds = timer.durationSeconds;
    const cycleIndex = Math.floor(elapsedSeconds / cycleSeconds);
    const cycleValueSeconds = elapsedSeconds % cycleSeconds;

    if (timer.lastCycleIndex !== null && cycleIndex > timer.lastCycleIndex && timer.beepEnabled) {
      beep();
    }
    timer.lastCycleIndex = cycleIndex;

    const el = document.getElementById(`${timer.id}-remaining`);
    if (el) el.textContent = formatHms(cycleValueSeconds);
  });
}

function syncCycleIndices(elapsedSeconds) {
  timerState.forEach((timer) => {
    timer.lastCycleIndex = Math.floor(elapsedSeconds / timer.durationSeconds);
  });
}

function startLoop(fromElapsedMs = 0) {
  if (tickHandle) clearInterval(tickHandle);
  const elapsedSeconds = Math.floor(fromElapsedMs / 1000);
  startTimeMs = performance.now() - fromElapsedMs;
  syncCycleIndices(elapsedSeconds);
  updateTick(fromElapsedMs);

  tickHandle = setInterval(() => {
    updateTick(performance.now() - startTimeMs);
    updateLiveClock();
  }, 100);
}

unlockBtn.addEventListener("click", async () => {
  const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextCtor) return;
  if (!audioCtx) audioCtx = new AudioContextCtor();
  if (audioCtx.state === "suspended") await audioCtx.resume();
  audioUnlocked = audioCtx.state === "running";

  if (!timersStarted) {
    timersStarted = true;
    timersPaused = false;
    pausedElapsedMs = 0;
    startLoop(0);
    unlockBtn.classList.add("ready");
    unlockBtn.textContent = "Running";
    unlockBtn.disabled = true;
    pauseBtn.disabled = false;
    resetBtn.disabled = false;
  }
});

pauseBtn.addEventListener("click", () => {
  if (!timersStarted) return;

  if (!timersPaused) {
    pausedElapsedMs = performance.now() - startTimeMs;
    if (tickHandle) clearInterval(tickHandle);
    tickHandle = null;
    timersPaused = true;
    pauseBtn.textContent = "Resume";
    unlockBtn.textContent = "Paused";
    return;
  }

  timersPaused = false;
  startLoop(pausedElapsedMs);
  pauseBtn.textContent = "Pause";
  unlockBtn.textContent = "Running";
});

resetBtn.addEventListener("click", () => {
  pausedElapsedMs = 0;
  syncCycleIndices(0);
  updateTick(0);

  if (timersStarted && !timersPaused) {
    startLoop(0);
  }
});

toggleAllBeeps.addEventListener("change", (e) => {
  setAllBeeps(e.target.checked);
});

renderTimers();
toggleAllBeeps.checked = timerState.every((timer) => timer.beepEnabled);
updateLiveClock();
setInterval(updateLiveClock, 250);
