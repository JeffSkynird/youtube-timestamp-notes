
# YouTube Timestamp Notes (Chrome Extension)

Simple extension to **take timestamped notes** on YouTube videos and **jump** to those points from a lightweight panel.

## What It Does
- Inserts a button (notebook icon) into the player controls.
- When clicked, a small panel appears over the video.
- **Alt+N** adds a quick mark at the current second (also opens the panel).
- Type a note and press **Save** to associate it with the current time.
- Click any timestamp to **jump** to that point.
- Notes are saved **per video** in `chrome.storage.local`.
- After adding, you can edit a note by clicking its body.

> Note: works on `https://www.youtube.com/*` pages (includes `watch` and `shorts`).

## Installation (Developer Mode)
1. Download and unzip this folder, or use the ZIP.
2. Open `chrome://extensions` in Chrome.
3. Enable **Developer mode** (top right).
4. Click **Load unpacked** and select the project folder.
5. Open a video on YouTube; you’ll see the notes button in the controls (right side).

## Usage
- **Alt+N**: adds a mark at the current second and opens the panel.
- **+ Mark** button: same as Alt+N.
- Text field + **Save**: adds the note with text.
- Click a **timestamp**: jumps to that point.
- Click the **body** of a note to edit.
- **✕**: deletes the note.

## Permissions: 
- local extension storage

## Privacy: 
- local data only; 
- no tracking, no external network or connections.

## Technical Details
- Manifest V3, `content_script` at `document_idle`.
- UI isolated with **Shadow DOM** attached to the player container (`#movie_player`).
- Inserts a button with class `ytp-button` inside `.ytp-right-controls` for visual integration.
- Detects YouTube SPA navigation via `yt-navigate-finish`, `yt-player-updated`, and `popstate` events.
- Accesses the current time via `<video.html5-main-video>` (standard API).

## Roadmap
- [ ] Sync notes across devices
- [ ] Export/import notes
- [ ] Add a panel to view all notes for each video
- [ ] Improve the "Add" icon in YouTube controls
- [ ] Adjust the edit input width
- [ ] Support Enter key (keydown) to confirm add or edit
