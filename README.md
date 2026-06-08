# Mascot

A desktop companion mascot that lives on your screen. Built with Electron, React, and Vite.

## Features

- **Always-on-top** floating mascot with a transparent, frameless window
- **Keyboard reactivity** — switches to a typing animation when you type
- **Cursor hunting** — the mascot's eyes follow your cursor; fast movement triggers a "hunting" animation
- **Sleep mode** — falls asleep after 30 seconds of inactivity
- **Drag anywhere** — click and hold the mascot to drag it around the screen
- **Right-click context menu** — adjust scale (1×, 1.5×, 2×), reset position, toggle always-on-top
- **Persistent settings** — position and scale are saved between sessions
- **Smart click-through** — clicks pass through transparent areas of the sprite

## States

| State | Trigger | Description |
|-------|---------|-------------|
| `idle` | Default | Gentle idle animation |
| `typing` | Any keystroke | Faster animation while typing, returns to idle after 1.5s of inactivity |
| `hunting` | Fast cursor movement | Eyes track cursor, returns to idle after 2s |
| `sleeping` | 30s of inactivity | Slow breathing animation |
| `dragging` | Click & hold | Locks position while being dragged |

## Development

```bash
# Install dependencies
npm install

# Start dev server (Vite hot-reload + Electron)
npm run dev
```

Open a second terminal and run `npm start` to launch the Electron window.

## Build

```bash
npm run build
```

## Package

Creates a distributable DMG for macOS:

```bash
npm run package
```

## Tech Stack

- [Electron](https://www.electronjs.org/)
- [React](https://react.dev/)
- [Vite](https://vitejs.dev/)
- [uiohook-napi](https://github.com/Snosky/uiohook-napi) — global keyboard hooks
- [electron-builder](https://www.electron.build/) — packaging

## AI Software Integration (Local HTTP API)

The mascot exposes a local HTTP API on port `40900` so that external AI editors and environments (Claude Desktop, VS Code, ChatGPT, Antigravity IDE, etc.) can trigger mascot thinking, success, and error animations.

### API Endpoints

- **Start Thinking**: `GET http://127.0.0.1:40900/thinking`
- **Finish / Success (Done)**: `GET http://127.0.0.1:40900/done` (Plays hop + meow sound, resets to idle in 2.5s)
- **Error**: `GET http://127.0.0.1:40900/error`
- **Reset to Idle**: `GET http://127.0.0.1:40900/idle`

### Example Integration

**JavaScript / Fetch (Browser Extensions, ChatGPT userscripts, VS Code extensions):**
```javascript
// Before making the AI API request:
fetch('http://127.0.0.1:40900/thinking');

// On success:
fetch('http://127.0.0.1:40900/done');

// On error:
fetch('http://127.0.0.1:40900/error');
```

**Python (Custom CLI Tools, Backends like Odysseus, Claude Desktop wrappers):**
```python
import urllib.request

def set_mascot_state(state):
    try:
        urllib.request.urlopen(f"http://127.0.0.1:40900/{state}", timeout=1)
    except Exception:
        pass # Mascot app not running
```
