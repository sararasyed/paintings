import { firebaseConfig, GITHUB_REPO } from "./firebase-config.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-app.js";
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js";

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const canvas = document.getElementById("canvas");
const playBtn = document.getElementById("play-btn");
const timelineSlider = document.getElementById("timeline-slider");

const STICKER_FRACTION = 0.16; // sticker width/height as a fraction of the canvas box's width
const IMAGE_EXTENSIONS = /\.(png|jpe?g|gif|webp|svg)$/i;

// filename -> { el, sticker } — kept in memory so window resize can re-lay-out
// every sticker from its normalized (0-1) position without re-reading Firestore.
const registry = new Map();

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

// --- Timeline: play/scrub through the order stickers were placed in ---

const PLAY_INTERVAL_MS = 600; // time to glide from one sticker to the next
let placementOrder = []; // sticker filenames, oldest first
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

// Recomputes placement order after stickers are (re)synced. If the timeline
// was already showing "everything" (the live view), it stays live.
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

function renderSticker(filename, sticker) {
  const el = document.createElement("div");
  el.className = "sticker";
  el.dataset.id = filename;
  el.dataset.rotation = sticker.rotation ?? 0;
  el.style.zIndex = sticker.zIndex;
  el.style.transform = `rotate(${sticker.rotation ?? 0}deg)`;

  const img = document.createElement("img");
  img.src = sticker.imageUrl;
  img.draggable = false;
  el.appendChild(img);

  registry.set(filename, { el, sticker });
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
      updateDoc(doc(db, "stickers", el.dataset.id), { x: nx, y: ny });
    }

    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerup", onUp);
  });
}

window.addEventListener("resize", () => {
  registry.forEach(({ el, sticker }) => layoutSticker(el, sticker));
});

// Lists whatever image files currently exist in the repo's stickers/ folder,
// via GitHub's public contents API — no manifest file to maintain by hand.
async function fetchStickerFiles() {
  const res = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/contents/stickers?ref=main`);
  if (!res.ok) return [];
  const entries = await res.json();
  return entries
    .filter((entry) => entry.type === "file" && IMAGE_EXTENSIONS.test(entry.name))
    .map((entry) => ({ name: entry.name, url: entry.download_url }));
}

// For each image currently in the stickers/ folder: reuse its saved position
// from Firestore, or if this is the first time it's been seen, give it a
// random spot and create that record. Images removed from the folder are
// simply not rendered (their old Firestore record is left as harmless debris).
async function syncStickers() {
  const files = await fetchStickerFiles();

  for (const file of files) {
    if (registry.has(file.name)) continue;

    const ref = doc(db, "stickers", file.name);
    const snap = await getDoc(ref);
    let sticker;

    if (snap.exists()) {
      sticker = snap.data();
    } else {
      const { x, y } = randomNormalizedPosition();
      sticker = {
        imageUrl: file.url,
        x,
        y,
        rotation: Math.random() * 16 - 8,
        zIndex: Date.now(),
      };
      await setDoc(ref, { ...sticker, createdAt: serverTimestamp() });
    }

    renderSticker(file.name, { ...sticker, imageUrl: file.url });
  }

  refreshTimeline();
}

syncStickers();
