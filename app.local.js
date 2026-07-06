// TEMPORARY local-only test harness — no Firebase, no password gate.
// Stickers are stored in this browser's localStorage only (not shared with other visitors).
// Swap index.html's <script src="app.local.js"> back to "app.js" once Firebase is set up
// (see README.md), then delete this file.

const STORAGE_KEY = "sticker-wall-local-stickers-v2";
const STICKER_FRACTION = 0.16; // sticker width/height as a fraction of the canvas box's width

const canvas = document.getElementById("canvas");
const unlockPanel = document.getElementById("unlock-panel");
const uploadPanel = document.getElementById("upload-panel");
const lockBtn = document.getElementById("lock-btn");
const fileInput = document.getElementById("file-input");
const playBtn = document.getElementById("play-btn");
const timelineSlider = document.getElementById("timeline-slider");

unlockPanel.classList.add("hidden");
uploadPanel.classList.remove("hidden");
lockBtn.style.display = "none";
document.body.classList.add("is-author"); // local test mode: deletion always allowed

// id -> { el, sticker } — kept in memory so window resize can re-lay-out
// every sticker from its normalized (0-1) position without re-reading storage.
const registry = new Map();

function loadAll() {
  return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
}

function saveAll(stickers) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(stickers));
}

function updateSticker(id, changes) {
  const stickers = loadAll();
  const sticker = stickers.find((s) => s.id === id);
  if (sticker) Object.assign(sticker, changes);
  saveAll(stickers);
}

function deleteSticker(id) {
  saveAll(loadAll().filter((s) => s.id !== id));
  const entry = registry.get(id);
  if (entry) {
    entry.el.remove();
    registry.delete(id);
  }
  refreshTimeline();
}

function selectSticker(id) {
  registry.forEach(({ el }, stickerId) => {
    el.classList.toggle("selected", stickerId === id);
  });
}

function deselectAll() {
  registry.forEach(({ el }) => el.classList.remove("selected"));
}

canvas.addEventListener("click", (e) => {
  if (e.target === canvas) deselectAll();
});

// --- Timeline: play/scrub through the order stickers were placed in ---

const PLAY_INTERVAL_MS = 600; // time to glide from one sticker to the next
let placementOrder = []; // sticker ids, oldest first
let playbackFrame = null;

function computeVisibility(value) {
  placementOrder.forEach((id, index) => {
    const entry = registry.get(id);
    if (!entry) return;
    entry.el.classList.toggle("timeline-hidden", index >= value);
  });
}

function applyTimelineValue(value) {
  timelineSlider.value = value;
  computeVisibility(value);
}

function stopPlayback() {
  if (playbackFrame != null) cancelAnimationFrame(playbackFrame);
  playbackFrame = null;
  playBtn.textContent = "▶";
}

function startPlayback() {
  if (placementOrder.length === 0) return;
  let base = Number(timelineSlider.value);
  if (base >= placementOrder.length) base = 0;
  playBtn.textContent = "⏸";

  let stepStart = null;

  function frame(now) {
    if (stepStart === null) stepStart = now;
    const progress = Math.min((now - stepStart) / PLAY_INTERVAL_MS, 1);
    const value = Math.min(base + progress, placementOrder.length);
    applyTimelineValue(value);

    if (value >= placementOrder.length) {
      stopPlayback();
      return;
    }
    if (progress >= 1) {
      base += 1;
      stepStart = now;
    }
    playbackFrame = requestAnimationFrame(frame);
  }

  playbackFrame = requestAnimationFrame(frame);
}

playBtn.addEventListener("click", () => {
  if (playbackFrame != null) stopPlayback();
  else startPlayback();
});

timelineSlider.addEventListener("input", () => {
  stopPlayback();
  computeVisibility(Number(timelineSlider.value));
});

// Recomputes placement order after a sticker is added/removed. If the
// timeline was already showing "everything" (the live view), it stays live;
// otherwise the current scrub position is left alone.
function refreshTimeline() {
  const wasLive = Number(timelineSlider.value) >= placementOrder.length;
  placementOrder = [...registry.entries()]
    .sort((a, b) => a[1].sticker.zIndex - b[1].sticker.zIndex)
    .map(([id]) => id);

  const hasStickers = placementOrder.length > 0;
  timelineSlider.max = placementOrder.length;
  timelineSlider.disabled = !hasStickers;
  playBtn.disabled = !hasStickers;

  if (wasLive && playbackFrame == null) {
    applyTimelineValue(placementOrder.length);
  } else {
    computeVisibility(Number(timelineSlider.value));
  }
}

fileInput.addEventListener("change", () => {
  const file = fileInput.files[0];
  if (file) handleImage(file);
  fileInput.value = "";
});

document.addEventListener("paste", (e) => {
  const item = [...e.clipboardData.items].find((i) => i.type.startsWith("image/"));
  if (item) handleImage(item.getAsFile());
});

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

// Sticker size in px, derived from the canvas box's current width so it
// rescales automatically whenever the window/canvas resizes.
function stickerPixelSize() {
  return canvas.clientWidth * STICKER_FRACTION;
}

function maxNormalized() {
  const size = stickerPixelSize();
  return {
    maxNX: 1 - size / canvas.clientWidth,
    maxNY: 1 - size / canvas.clientHeight,
  };
}

function randomNormalizedPosition() {
  const { maxNX, maxNY } = maxNormalized();
  return {
    x: Math.random() * Math.max(0, maxNX),
    y: Math.random() * Math.max(0, maxNY),
  };
}

function handleImage(file) {
  const reader = new FileReader();
  reader.onload = () => {
    const { x, y } = randomNormalizedPosition();
    const sticker = {
      id: crypto.randomUUID(),
      imageUrl: reader.result,
      x,
      y,
      rotation: Math.random() * 16 - 8,
      zIndex: Date.now(),
    };
    const stickers = loadAll();
    stickers.push(sticker);
    saveAll(stickers);
    renderSticker(sticker);
    refreshTimeline();
  };
  reader.readAsDataURL(file);
}

// Applies a sticker's normalized x/y and current canvas size to its element's
// actual pixel position/size. Called on render and again on every resize.
function layoutSticker(el, sticker) {
  const size = stickerPixelSize();
  const { maxNX, maxNY } = maxNormalized();
  const nx = clamp(sticker.x, 0, Math.max(0, maxNX));
  const ny = clamp(sticker.y, 0, Math.max(0, maxNY));
  el.style.width = `${size}px`;
  el.style.height = `${size}px`;
  el.style.left = `${nx * canvas.clientWidth}px`;
  el.style.top = `${ny * canvas.clientHeight}px`;
}

function renderSticker(sticker) {
  const el = document.createElement("div");
  el.className = "sticker";
  el.dataset.id = sticker.id;
  el.dataset.rotation = sticker.rotation;
  el.style.zIndex = sticker.zIndex;
  el.style.transform = `rotate(${sticker.rotation}deg)`;

  const img = document.createElement("img");
  img.src = sticker.imageUrl;
  img.draggable = false;
  el.appendChild(img);

  const deleteBtn = document.createElement("button");
  deleteBtn.className = "sticker-delete";
  deleteBtn.textContent = "×";
  deleteBtn.setAttribute("aria-label", "Remove sticker");
  deleteBtn.addEventListener("pointerdown", (e) => e.stopPropagation());
  deleteBtn.addEventListener("click", () => deleteSticker(sticker.id));
  el.appendChild(deleteBtn);

  registry.set(sticker.id, { el, sticker });
  layoutSticker(el, sticker);
  makeDraggable(el, sticker);
  canvas.appendChild(el);
}

function makeDraggable(el, sticker) {
  el.addEventListener("pointerdown", (e) => {
    el.setPointerCapture(e.pointerId);
    const startX = e.clientX;
    const startY = e.clientY;
    const origLeft = el.offsetLeft;
    const origTop = el.offsetTop;
    const rotation = el.dataset.rotation;
    const size = stickerPixelSize();
    const maxLeft = canvas.clientWidth - size;
    const maxTop = canvas.clientHeight - size;
    el.style.zIndex = Date.now();

    function onMove(e) {
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      el.style.transform = `translate(${dx}px, ${dy}px) rotate(${rotation}deg)`;
    }

    function onUp(e) {
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerup", onUp);
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      const newLeft = clamp(origLeft + dx, 0, Math.max(0, maxLeft));
      const newTop = clamp(origTop + dy, 0, Math.max(0, maxTop));
      el.style.left = `${newLeft}px`;
      el.style.top = `${newTop}px`;
      el.style.transform = `rotate(${rotation}deg)`;

      const nx = newLeft / canvas.clientWidth;
      const ny = newTop / canvas.clientHeight;
      sticker.x = nx;
      sticker.y = ny;
      updateSticker(sticker.id, { x: nx, y: ny });
      selectSticker(sticker.id);
    }

    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerup", onUp);
  });
}

window.addEventListener("resize", () => {
  registry.forEach(({ el, sticker }) => layoutSticker(el, sticker));
});

loadAll().forEach(renderSticker);
refreshTimeline();
