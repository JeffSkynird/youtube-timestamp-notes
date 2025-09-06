
(() => {
  const BTN_ID = "yt-notes-btn";
  const HOST_ID = "yt-notes-host";
  const KEY_PREFIX = "ytNotes:";

  let currentVideoId = null;
  let shadowRoot = null;
  let ui = null;
  let lastNewNoteId = null; 

  // ---------- Utilities ----------
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));

  function getVideoId() {
    try {
      const url = new URL(location.href);
      if (url.pathname.startsWith("/shorts/")) {
        const parts = url.pathname.split("/").filter(Boolean);
        return parts[1] || null;
      }
      return url.searchParams.get("v");
    } catch {
      return null;
    }
  }

  function videoEl() {
    return document.querySelector("video.html5-main-video");
  }

  function keyFor(id) {
    return KEY_PREFIX + id;
  }

  function formatTime(sec) {
    sec = Math.max(0, Math.floor(sec));
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    const parts = [m.toString().padStart(2, "0"), s.toString().padStart(2, "0")];
    return (h > 0 ? h + ":" : "") + parts.join(":");
  }

  function qs(sel, root = document) {
    return root.querySelector(sel);
  }

  // ---------- Storage ----------
  function getNotes(vid) {
    return new Promise((resolve) => {
      if (!vid) return resolve([]);
      chrome.storage.local.get([keyFor(vid)], (obj) => {
        resolve(obj[keyFor(vid)] || []);
      });
    });
  }

  function setNotes(vid, notes) {
    return new Promise((resolve) => {
      if (!vid) return resolve();
      chrome.storage.local.set({ [keyFor(vid)]: notes }, () => resolve());
    });
  }

  // ---------- UI ----------
  function ensureButton() {
    if (document.getElementById(BTN_ID)) return;

    const controls = qs(".ytp-right-controls");
    if (!controls) return;

    const btn = document.createElement("button");
    btn.id = BTN_ID;
    btn.className = "ytp-button "
    btn.title = "Notes (Alt+N to add)";
    btn.setAttribute("aria-label", "Notas del video");
    btn.style.width = "48px";
    btn.style.height = "48px";
    btn.innerHTML = `
      <svg viewBox="0 0 36 36" width="100%" height="100%" focusable="false" aria-hidden="true" style="align-self: center;">
        <g fill="currentColor">
          <rect x="10" y="8" width="16" height="20" rx="2" ry="2"></rect>
          <rect x="13" y="12" width="10" height="2" rx="1"></rect>
          <rect x="13" y="16" width="10" height="2" rx="1"></rect>
          <rect x="13" y="20" width="7"  height="2" rx="1"></rect>
        </g>
      </svg>
    `;
    btn.addEventListener("click", togglePanel);
    controls.prepend(btn);
  }

  function buildHost() {
    if (document.getElementById(HOST_ID)) return;
    const player = qs("#movie_player");
    if (!player) return;
    const host = document.createElement("div");
    host.id = HOST_ID;
    host.style.position = "absolute";
    host.style.top = "10px";
    host.style.right = "10px";
    host.style.zIndex = "1000";
    host.style.pointerEvents = "none";
    player.appendChild(host);
    shadowRoot = host.attachShadow({ mode: "open" });

    const style = document.createElement("style");
    style.textContent = `
      :host { all: initial; }
      .panel {
        font-family: system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif;
        width: 320px;
        max-width: min(90vw, 360px);
        max-height: 60vh;
        background: rgba(28,28,28,0.98);
        color: #fff;
        border-radius: 12px;
        box-shadow: 0 10px 30px rgba(0,0,0,0.4);
        overflow: hidden;
        display: none;
        pointer-events: auto;
      }
      .panel.visible { display: grid; grid-template-rows: auto auto 1fr; }
      .hdr {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 8px 10px;
        border-bottom: 1px solid rgba(255,255,255,0.08);
        flex-wrap: wrap;
      }
      .hdr .title { font-weight: 600; font-size: 14px; min-width: 0; }
      .hdr .spacer { flex: 1; min-width: 0; }
      .hdr button {
        background: transparent; color: #ddd; border: 0; cursor: pointer;
        font-size: 14px; padding: 4px 6px; border-radius: 6px; white-space: nowrap;
      }
      .hdr button:hover { background: rgba(255,255,255,0.08); color: #fff; }
      .adder {
        display: grid; grid-template-columns: auto 1fr auto; gap: 6px;
        padding: 8px 10px; align-items: center;
      }
      .adder input[type="text"] {
        background: rgba(255,255,255,0.08);
        border: 1px solid rgba(255,255,255,0.15);
        color: #fff; border-radius: 8px; padding: 8px;
        outline: none;
        min-width: 0;
      }
      .adder .time {
        font-variant-numeric: tabular-nums;
        padding: 0 4px; color: #9ad; user-select: none; white-space: nowrap;
      }
      .adder .btn {
        background: #3ea6ff; color: #111; border: 0; padding: 8px 10px;
        border-radius: 8px; font-weight: 600; cursor: pointer; white-space: nowrap;
      }
      .adder .btn:hover { filter: brightness(1.05); }
      .list {
        overflow: auto; padding: 4px 8px 8px 8px;
      }
      .item {
        display: grid; grid-template-columns: auto 1fr auto; gap: 8px;
        align-items: center; padding: 6px 6px; border-radius: 8px;
      }
      .item:hover { background: rgba(255,255,255,0.06); }
      .item .ts {
        font-variant-numeric: tabular-nums;
        color: #9ad; cursor: pointer; padding: 4px 6px; border-radius: 6px; white-space: nowrap;
      }
      .item .ts:hover { background: rgba(154,205,255,0.12); }
      .item .txt { color: #eee; white-space: pre-wrap; word-break: break-word; min-width: 0; }
      .item .txt.empty { color: #aaa; font-style: italic; }
      .item .edit {
        background: rgba(255,255,255,0.08);
        border: 1px solid rgba(255,255,255,0.15);
        color: #fff; border-radius: 6px; padding: 6px 8px; width: 100%;
        outline: none;
      }
      .item .del {
        background: transparent; border: 0; color: #bbb; cursor: pointer; padding: 4px 6px; border-radius: 6px; white-space: nowrap;
      }
      .item .del:hover { background: rgba(255,255,255,0.08); color: #fff; }
      .item.editing .del { display: none; }
      .muted { color: #aaa; font-size: 12px; padding: 6px 8px; }
    `;
    shadowRoot.appendChild(style);

    ui = document.createElement("div");
    ui.className = "panel";
    ui.innerHTML = `
      <div class="hdr">
        <div class="title">Video Notes</div>
        <div class="spacer"></div>
        <button id="add-now" title="Add marker (Alt+N)">+ Marker</button>
        <button id="close" aria-label="Close" title="Close">×</button>
      </div>
      <div class="adder">
        <div class="time" id="curr-time">00:00</div>
        <input id="note-input" type="text" placeholder="Write a note…" autocomplete="off"/>
        <button class="btn" id="save-note">Save</button>
      </div>
      <div class="list" id="notes-list"></div>
    `;
    shadowRoot.appendChild(ui);

    const input = shadowRoot.getElementById("note-input");

    // --- Block YouTube keyboard shortcuts while typing in panel ---
    const stopYtShortcuts = (e) => {
      e.stopPropagation();
      if (typeof e.stopImmediatePropagation === "function") e.stopImmediatePropagation();
    };
    ["keydown","keypress","keyup"].forEach(type => {
      input.addEventListener(type, stopYtShortcuts, true);
      input.addEventListener(type, stopYtShortcuts);
    });
    const globalStopper = (e) => {
      if (!ui || !ui.classList.contains("visible")) return;
      const path = e.composedPath ? e.composedPath() : [];
      if (path && (path.includes(ui))) {
        e.stopPropagation();
        if (typeof e.stopImmediatePropagation === "function") e.stopImmediatePropagation();
      }
    };
    document.addEventListener("keydown", globalStopper, true);
    document.addEventListener("keypress", globalStopper, true);
    document.addEventListener("keyup", globalStopper, true);

    shadowRoot.getElementById("close").addEventListener("click", () => togglePanel(false));
    shadowRoot.getElementById("add-now").addEventListener("click", async () => {
      await quickAdd();
      togglePanel(true); // ensure visible
    });
    shadowRoot.getElementById("save-note").addEventListener("click", () => saveNoteFromInput());

    // Save from the top input when pressing Enter
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        e.stopPropagation();
        if (typeof e.stopImmediatePropagation === "function") e.stopImmediatePropagation();
        saveNoteFromInput();
      }
    });

    // Keep current time display in sync
    setInterval(() => {
      const v = videoEl();
      const t = v ? v.currentTime : 0;
      const el = shadowRoot.getElementById("curr-time");
      if (el) el.textContent = formatTime(t || 0);
    }, 250);
  }

  function togglePanel(forceState) {
    if (!ui) return;
    const shouldOpen = typeof forceState === "boolean" ? forceState : !ui.classList.contains("visible");
    if (shouldOpen) {
      ui.classList.add("visible");
      const inp = shadowRoot.getElementById("note-input");
      if (inp) {
        inp.focus();
        inp.select();
      }
      renderList();
    } else {
      ui.classList.remove("visible");
    }
  }

  // --- Inline edit helpers ---
  function enterEditMode(row, note) {
    let txt = row.querySelector(".txt");
    if (!txt) return;
    // Mark row as editing to hide delete button
    row.classList.add("editing");
    const created = note.created;
    const input = document.createElement("input");
    input.type = "text";
    input.className = "edit";
    input.value = note.text || "";
    input.placeholder = "Añade una nota…";
    // prevent YT shortcuts
    const stop = (e) => {
      // Block YT shortcuts and prevent default actions when editing
      e.stopPropagation();
      if (typeof e.stopImmediatePropagation === "function") e.stopImmediatePropagation();
    };
    ["keydown","keypress","keyup"].forEach(type => {
      input.addEventListener(type, stop, true);
      input.addEventListener(type, stop);
    });

    const save = async () => {
      const vid = currentVideoId || getVideoId();
      const all = await getNotes(vid);
      const idx = all.findIndex(x => x.created === created);
      if (idx >= 0) {
        all[idx].text = input.value.trim();
        await setNotes(vid, all);
      }
      renderList();
    };
    const cancel = () => {
      renderList();
    };

    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        e.stopPropagation();
        if (typeof e.stopImmediatePropagation === "function") e.stopImmediatePropagation();
        save();
      }
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        if (typeof e.stopImmediatePropagation === "function") e.stopImmediatePropagation();
        cancel();
      }
    });
    input.addEventListener("blur", save);

    txt.replaceWith(input);
    input.focus();
    // Move caret to end
    const val = input.value;
    input.value = "";
    input.value = val;
  }

  async function renderList() {
    if (!ui) return;
    const list = shadowRoot.getElementById("notes-list");
    if (!list) return;
    const vid = currentVideoId || getVideoId();
    const notes = (await getNotes(vid)).slice().sort((a,b) => a.t - b.t);
    if (!notes.length) {
      list.innerHTML = `<div class="muted">No notes yet. Use <b>Alt+N</b> to add a quick marker or write a note and press Save.</div>`;
      return;
    }
    list.innerHTML = "";
    for (const n of notes) {
      const row = document.createElement("div");
      row.className = "item";
      row.dataset.created = String(n.created);

      const tsBtn = document.createElement("div");
      tsBtn.className = "ts";
      tsBtn.textContent = formatTime(n.t);
      tsBtn.title = "Go to " + formatTime(n.t);
      tsBtn.addEventListener("click", () => seekTo(n.t));

      const txt = document.createElement("div");
      txt.className = "txt" + ((n.text || "").trim() ? "" : " empty");
      txt.textContent = (n.text || "").trim() || "— no text —";
      txt.title = "Click to edit";
      txt.addEventListener("click", () => enterEditMode(row, n));

      const del = document.createElement("button");
      del.className = "del";
      del.textContent = "✕";
      del.title = "Delete";
      del.addEventListener("click", async () => {
        const all = await getNotes(vid);
        const filtered = all.filter(x => !(x.t === n.t && x.text === n.text && x.created === n.created));
        await setNotes(vid, filtered);
        renderList();
      });

      row.appendChild(tsBtn);
      row.appendChild(txt);
      row.appendChild(del);
      list.appendChild(row);

      // If this was just added via quickAdd, auto-enter edit mode
      if (lastNewNoteId && n.created === lastNewNoteId) {
        enterEditMode(row, n);
        lastNewNoteId = null;
      }
    }
  }

  function seekTo(t) {
    const v = videoEl();
    if (!v) return;
    v.currentTime = t;
    v.focus();
  }

  async function quickAdd() {
    const vid = currentVideoId || getVideoId();
    const v = videoEl();
    if (!vid || !v) return;
    const t = Math.floor(v.currentTime || 0);
    const created = Date.now();
    const all = await getNotes(vid);
    all.push({ t, text: "", created });
    await setNotes(vid, all);
    lastNewNoteId = created;
    renderList();
  }

  async function saveNoteFromInput() {
    const vid = currentVideoId || getVideoId();
    const v = videoEl();
    if (!vid || !v) return;
    const input = shadowRoot.getElementById("note-input");
    const text = (input?.value || "").trim();
    const t = Math.floor(v.currentTime || 0);
    const all = await getNotes(vid);
    all.push({ t, text, created: Date.now() });
    await setNotes(vid, all);
    input.value = "";
    renderList();
  }

  // ---------- Navigation / lifecycle ----------
  function onKeydown(e) {
    // If typing inside our panel, ignore global hotkeys
    const path = e.composedPath ? e.composedPath() : [];
    const typingInPanel = ui && ui.classList.contains("visible") && path && path.includes(ui);
    if (typingInPanel) return;

    if (e.altKey && e.code === "KeyN") {
      e.preventDefault();
      ensureButton();
      buildHost();
      quickAdd().then(() => togglePanel(true));
    }
  }

  async function setupForCurrentPage() {
    currentVideoId = getVideoId();
    if (!currentVideoId) return;
    for (let i=0; i<40; i++) {
      ensureButton();
      buildHost();
      if (videoEl() && ui) break;
      await sleep(150);
    }
    renderList();
  }

  function attachObservers() {
    window.addEventListener("yt-navigate-finish", setupForCurrentPage);
    window.addEventListener("yt-player-updated", setupForCurrentPage);
    window.addEventListener("popstate", setupForCurrentPage);

    const mo = new MutationObserver(() => {
      ensureButton();
      if (!document.getElementById(HOST_ID)) {
        buildHost();
      }
    });
    mo.observe(document.documentElement, { childList: true, subtree: true });

    document.addEventListener("keydown", onKeydown, true);
  }

  // ---------- Init ----------
  (async () => {
    attachObservers();
    await setupForCurrentPage();
  })();

})();
