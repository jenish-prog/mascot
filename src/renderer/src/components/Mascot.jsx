import React, { useRef, useEffect, useState } from 'react';
import idle1 from '../assets/sprites/idle_1.png';
import idle2 from '../assets/sprites/idle_2.png';
import typing1 from '../assets/sprites/typing_1.png';
import typing2 from '../assets/sprites/typing_2.png';
import typingRed1 from '../assets/sprites/typing_red_1.png';
import typingRed2 from '../assets/sprites/typing_red_2.png';
import sleeping1 from '../assets/sprites/sleeping_1.png';
import sleeping2 from '../assets/sprites/sleeping_2.png';
import dragging1 from '../assets/sprites/dragging_1.png';
import hunting1 from '../assets/sprites/hunting_1.png';
import hunting2 from '../assets/sprites/hunting_2.png';
import petting1 from '../assets/sprites/petting_1.png';
import petting2 from '../assets/sprites/petting_2.png';
import scroll1 from '../assets/sprites/scroll_1.png';
import scroll2 from '../assets/sprites/scroll_2.png';
import heartSprite from '../assets/sprites/heart.png';

const SPRITES = {
  idle: [idle1, idle2],
  typing: [typing1, typing2],
  typing_red: [typingRed1, typingRed2],
  sleeping: [sleeping1, sleeping2],
  dragging: [dragging1],
  hunting: [hunting1, hunting2],
  petting: [petting1, petting2],
  scrolling: [scroll1, scroll2]
};

// Flood-fill algorithm starting from borders to remove solid white background
const removeBackground = (ctx, width, height) => {
  const imgData = ctx.getImageData(0, 0, width, height);
  const data = imgData.data;
  const visited = new Uint8Array(width * height);
  const queue = [];

  const getPixelIndex = (x, y) => (y * width + x) * 4;

  const isWhite = (r, g, b) => {
    return r > 200 && g > 200 && b > 200; // Increased tolerance for compressed white backgrounds
  };

  // Seed the queue with all border pixels of the image
  for (let x = 0; x < width; x++) {
    // Top border
    let idx = 0 * width + x;
    let pIdx = idx * 4;
    if (isWhite(data[pIdx], data[pIdx + 1], data[pIdx + 2]) && !visited[idx]) {
      queue.push([x, 0]);
      visited[idx] = 1;
    }
    // Bottom border
    idx = (height - 1) * width + x;
    pIdx = idx * 4;
    if (isWhite(data[pIdx], data[pIdx + 1], data[pIdx + 2]) && !visited[idx]) {
      queue.push([x, height - 1]);
      visited[idx] = 1;
    }
  }

  for (let y = 0; y < height; y++) {
    // Left border
    let idx = y * width + 0;
    let pIdx = idx * 4;
    if (isWhite(data[pIdx], data[pIdx + 1], data[pIdx + 2]) && !visited[idx]) {
      queue.push([0, y]);
      visited[idx] = 1;
    }
    // Right border
    idx = y * width + (width - 1);
    pIdx = idx * 4;
    if (isWhite(data[pIdx], data[pIdx + 1], data[pIdx + 2]) && !visited[idx]) {
      queue.push([width - 1, y]);
      visited[idx] = 1;
    }
  }

  const directions = [
    [0, 1], [0, -1], [1, 0], [-1, 0]
  ];

  while (queue.length > 0) {
    const [x, y] = queue.shift();
    const pIdx = getPixelIndex(x, y);

    // Make the background pixel fully transparent
    data[pIdx + 3] = 0;

    for (const [dx, dy] of directions) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
        const nIdx = ny * width + nx;
        if (!visited[nIdx]) {
          const npIdx = getPixelIndex(nx, ny);
          if (isWhite(data[npIdx], data[npIdx + 1], data[npIdx + 2])) {
            queue.push([nx, ny]);
            visited[nIdx] = 1;
          }
        }
      }
    }
  }

  ctx.putImageData(imgData, 0, 0);
};

// Connected component analysis helper that scans for pixels passing the test callback
const findConnectedEyes = (ctx, width, height, pixelTest) => {
  const imgData = ctx.getImageData(0, 0, width, height);
  const data = imgData.data;
  const visited = new Uint8Array(width * height);
  const components = [];

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      if (visited[idx] || !pixelTest(data[idx * 4], data[idx * 4 + 1], data[idx * 4 + 2], data[idx * 4 + 3])) {
        continue;
      }

      // BFS to find contiguous eye region
      const queue = [[x, y]];
      visited[idx] = 1;
      let minX = x, maxX = x, minY = y, maxY = y;
      let pixelCount = 0;
      let sumX = 0, sumY = 0;

      while (queue.length > 0) {
        const [cx, cy] = queue.shift();
        pixelCount++;
        sumX += cx;
        sumY += cy;

        if (cx < minX) minX = cx;
        if (cx > maxX) maxX = cx;
        if (cy < minY) minY = cy;
        if (cy > maxY) maxY = cy;

        const neighbors = [
          [cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]
        ];

        for (const [nx, ny] of neighbors) {
          if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
            const nIdx = ny * width + nx;
            if (!visited[nIdx] && pixelTest(data[nIdx * 4], data[nIdx * 4 + 1], data[nIdx * 4 + 2], data[nIdx * 4 + 3])) {
              visited[nIdx] = 1;
              queue.push([nx, ny]);
            }
          }
        }
      }

      components.push({
        minX, maxX, minY, maxY,
        width: maxX - minX + 1,
        height: maxY - minY + 1,
        pixelCount,
        centerX: sumX / pixelCount,
        centerY: sumY / pixelCount
      });
    }
  }

  // Filter components to find the circular eyeballs inside the head
  const candidates = components.filter(c => {
    const aspectRatio = c.width / c.height;
    return (
      c.pixelCount > 100 && c.pixelCount < 30000 &&
      aspectRatio > 0.6 && aspectRatio < 1.6 &&
      c.centerY > height * 0.15 && c.centerY < height * 0.8 &&
      c.centerX > width * 0.1 && c.centerX < width * 0.9
    );
  });

  // Sort left to right
  candidates.sort((a, b) => a.centerX - b.centerX);

  // Match the best symmetrical pair
  if (candidates.length >= 2) {
    let bestPair = null;
    let minScore = Infinity;

    for (let i = 0; i < candidates.length; i++) {
      for (let j = i + 1; j < candidates.length; j++) {
        const a = candidates[i];
        const b = candidates[j];

        const yDiff = Math.abs(a.centerY - b.centerY);
        const sizeDiff = Math.abs(a.height - b.height);
        const dist = Math.abs(a.centerX - b.centerX);

        if (dist > width * 0.15 && yDiff < height * 0.08) {
          const score = yDiff * 3 + sizeDiff;
          if (score < minScore) {
            minScore = score;
            bestPair = [a, b];
          }
        }
      }
    }
    return bestPair;
  }

  return null;
};

// Double-pass eyeball finder (Pass 1: White eyes, Pass 2: Black/Dark eyes fallback)
const findEyes = (ctx, width, height) => {
  // Pass 1: Opaque white pixel test (eyeball sclera)
  const isWhiteEye = (r, g, b, a) => a === 255 && r > 220 && g > 220 && b > 220;
  let eyes = findConnectedEyes(ctx, width, height, isWhiteEye);
  if (eyes) {
    console.log('[findEyes] Found white eyeballs at left:', Math.round(eyes[0].centerX), 'right:', Math.round(eyes[1].centerX));
    return eyes;
  }

  // Pass 2: Opaque dark pixel test (pupil/border fallback)
  const isDarkEye = (r, g, b, a) => a === 255 && r < 60 && g < 60 && b < 60;
  eyes = findConnectedEyes(ctx, width, height, isDarkEye);
  if (eyes) {
    console.log('[findEyes] Found dark eyeballs fallback at left:', Math.round(eyes[0].centerX), 'right:', Math.round(eyes[1].centerX));
    return eyes;
  }

  console.log('[findEyes] Eyeballs not found in both passes');
  return null;
};

export default function Mascot({ state, frame, scale, typingHeat = 0, onDragStart, onPet }) {
  const canvasRef = useRef(null);
  const cacheCanvasRef = useRef(document.createElement('canvas'));

  const [hearts, setHearts] = useState([]);
  const [transparentHeartUrl, setTransparentHeartUrl] = useState(null);
  const [steamPuffs, setSteamPuffs] = useState([]);
  const lastMovePosRef = useRef({ x: 0, y: 0 });
  const petHistoryRef = useRef([]);

  // Transparentize the heart sprite once on mount
  useEffect(() => {
    const img = new Image();
    img.src = heartSprite;
    img.onload = () => {
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = img.width;
      tempCanvas.height = img.height;
      const tempCtx = tempCanvas.getContext('2d', { willReadFrequently: true });
      tempCtx.drawImage(img, 0, 0);
      removeBackground(tempCtx, img.width, img.height);
      setTransparentHeartUrl(tempCanvas.toDataURL());
    };
  }, []);

  // Spawn a heart at the top of the cat's head
  const spawnHeart = () => {
    const size = 128 * scaleRef.current;
    // Spawn near the upper center (head area)
    const startX = size * 0.35 + Math.random() * (size * 0.3);
    const startY = size * 0.15 + Math.random() * (size * 0.1);

    const newHeart = {
      id: Math.random(),
      x: startX,
      y: startY,
      vx: (Math.random() - 0.5) * 0.5,
      vy: 0.8 + Math.random() * 1.2,
      opacity: 1.0,
      scale: 0.5 + Math.random() * 0.4,
    };
    setHearts((prev) => [...prev, newHeart]);
  };

  // Hearts particle animation loop
  useEffect(() => {
    if (hearts.length === 0) return;

    const interval = setInterval(() => {
      setHearts((prev) =>
        prev
          .map((h) => ({
            ...h,
            y: h.y - h.vy,
            x: h.x + Math.sin(h.y * 0.08) * 0.4 + h.vx,
            opacity: h.opacity - 0.015,
            scale: h.scale + 0.003,
          }))
          .filter((h) => h.opacity > 0)
      );
    }, 32);

    return () => clearInterval(interval);
  }, [hearts]);

  // Periodically spawn hearts while petting state is active
  useEffect(() => {
    if (state !== 'petting') return;

    spawnHeart();
    const spawnTimer = setInterval(() => {
      spawnHeart();
    }, 300);

    return () => clearInterval(spawnTimer);
  }, [state, scale]);

  // Steam puff particles when heat is very high
  useEffect(() => {
    if (typingHeat < 0.7) {
      setSteamPuffs([]);
      return;
    }

    const spawnSteam = () => {
      const size = 128 * scaleRef.current;
      setSteamPuffs(prev => {
        // Max 6 puffs at once
        if (prev.length >= 6) return prev;
        const side = Math.random() > 0.5 ? 1 : -1;
        return [...prev, {
          id: Math.random(),
          x: size * 0.5 + side * (size * 0.15 + Math.random() * size * 0.1),
          y: size * 0.08,
          vx: side * (0.4 + Math.random() * 0.6),
          vy: -(0.6 + Math.random() * 0.8),
          opacity: 0.85,
          size: 6 + Math.random() * 8,
        }];
      });
    };

    spawnSteam();
    const interval = setInterval(spawnSteam, 220);
    return () => clearInterval(interval);
  }, [typingHeat, scale]);

  // Animate steam puffs
  useEffect(() => {
    if (steamPuffs.length === 0) return;
    const interval = setInterval(() => {
      setSteamPuffs(prev =>
        prev
          .map(p => ({
            ...p,
            x: p.x + p.vx,
            y: p.y + p.vy,
            vy: p.vy * 0.97,
            opacity: p.opacity - 0.025,
            size: p.size + 0.5,
          }))
          .filter(p => p.opacity > 0)
      );
    }, 30);
    return () => clearInterval(interval);
  }, [steamPuffs]);

  // Coordinate tracking refs
  const cursorPosRef = useRef({ x: 0, y: 0 });
  const boundsRef = useRef({ x: 0, y: 0, width: 150, height: 150 });
  const leftEyeRef = useRef(null);
  const rightEyeRef = useRef(null);

  // Sync state and scale in refs to bypass React re-renders in global cursor listener
  const stateRef = useRef(state);
  const scaleRef = useRef(scale);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    scaleRef.current = scale;
  }, [scale]);

  // Core render implementation that draws the base sprite and layers the moving eyes
  const drawCurrentState = () => {
    const canvas = canvasRef.current;
    if (!canvas || !cacheCanvasRef.current) return;

    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(cacheCanvasRef.current, 0, 0);

    const activeState = stateRef.current;
    const activeScale = scaleRef.current;

    // Draw follow eyes only if eyeballs were detected and the mascot is awake
    if (activeState !== 'sleeping' && leftEyeRef.current && rightEyeRef.current) {
      const cursor = cursorPosRef.current;
      const bounds = boundsRef.current;

      const displaySize = 128 * activeScale;
      const canvasOffset = (bounds.width - displaySize) / 2;

      // Calculate cursor pos relative to canvas top-left
      const relX = cursor.x - (bounds.x + canvasOffset);
      const relY = cursor.y - (bounds.y + canvasOffset);

      // Scale coordinates to the internal 1024x1024 grid
      const scaleFactor = 1024 / displaySize;
      const targetX = relX * scaleFactor;
      const targetY = relY * scaleFactor;

      console.log(`[drawCurrentState] state=${activeState}, scale=${activeScale}, cursor=(${cursor.x},${cursor.y}), bounds=(${bounds.x},${bounds.y},${bounds.width}x${bounds.height}), rel=(${Math.round(relX)},${Math.round(relY)}), target=(${Math.round(targetX)},${Math.round(targetY)})`);

      const drawEye = (eye, name) => {
        const cx = eye.centerX;
        const cy = eye.centerY;
        const r = Math.max(eye.width, eye.height) / 2;

        // 1. Draw solid white eyeball circle
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fillStyle = '#ffffff';
        ctx.fill();

        // 2. Draw black border outline
        ctx.lineWidth = Math.max(3, r * 0.12);
        ctx.strokeStyle = '#000000';
        ctx.stroke();

        // 3. Compute offset pupil position
        const dx = targetX - cx;
        const dy = targetY - cy;
        const dist = Math.sqrt(dx * dx + dy * dy);

        const pupilRadius = activeState === 'hunting' ? r * 0.65 : r * 0.45;
        const maxOffset = r - pupilRadius - ctx.lineWidth;
        const offset = dist > 0 ? Math.min(dist * 0.12, maxOffset) : 0;

        const ox = dist > 0 ? (dx / dist) * offset : 0;
        const oy = dist > 0 ? (dy / dist) * offset : 0;

        console.log(`  [${name}Eye] center=(${Math.round(cx)},${Math.round(cy)}), r=${Math.round(r)}, pupilRadius=${Math.round(pupilRadius)}, maxOffset=${Math.round(maxOffset)}, offset=(${Math.round(ox)},${Math.round(oy)})`);

        // 4. Draw black pupil pixel/circle
        ctx.beginPath();
        ctx.arc(cx + ox, cy + oy, pupilRadius, 0, Math.PI * 2);
        ctx.fillStyle = '#000000';
        ctx.fill();
      };

      drawEye(leftEyeRef.current, 'Left');
      drawEye(rightEyeRef.current, 'Right');
    } else {
      console.log(`[drawCurrentState] Skipped follow eyes. state=${activeState}, leftEye=${leftEyeRef.current ? 'Found' : 'Null'}, rightEye=${rightEyeRef.current ? 'Found' : 'Null'}`);
    }
  };

  // Redraw cache sprite when frame or state changes
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const imgList = SPRITES[state] || SPRITES.idle;
    const imgUrl = imgList[frame % imgList.length] || imgList[0];

    const img = new Image();
    img.src = imgUrl;
    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;

      const cache = cacheCanvasRef.current;
      cache.width = img.width;
      cache.height = img.height;

      const cacheCtx = cache.getContext('2d', { willReadFrequently: true });
      cacheCtx.clearRect(0, 0, cache.width, cache.height);
      cacheCtx.drawImage(img, 0, 0);

      // Process transparency
      removeBackground(cacheCtx, cache.width, cache.height);

      // Detect eyeballs
      const eyes = findEyes(cacheCtx, cache.width, cache.height);
      if (eyes) {
        leftEyeRef.current = eyes[0];
        rightEyeRef.current = eyes[1];
      } else {
        leftEyeRef.current = null;
        rightEyeRef.current = null;
      }

      // Initial redraw
      drawCurrentState();
    };
  }, [state, frame]);

  // Listen to the throttled global cursor events and bounds updates
  useEffect(() => {
    const removeCursorListener = window.electronAPI.onGlobalCursor(({ cursor, bounds }) => {
      cursorPosRef.current = cursor;
      boundsRef.current = bounds;
      drawCurrentState();
    });

    return () => {
      removeCursorListener();
    };
  }, []);

  // Check hover transparency for click-through forwarding
  const handleMouseMove = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = Math.floor(((e.clientX - rect.left) / rect.width) * canvas.width);
    const y = Math.floor(((e.clientY - rect.top) / rect.height) * canvas.height);

    if (x >= 0 && x < canvas.width && y >= 0 && y < canvas.height) {
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      const pixel = ctx.getImageData(x, y, 1, 1).data;
      const alpha = pixel[3];

      if (alpha > 0) {
        window.electronAPI.setIgnoreMouseEvents(false);

        // Detect petting on the head (upper region, alpha > 0)
        if (y < 550 && onPet) {
          const lastMove = lastMovePosRef.current;
          const dx = x - lastMove.x;
          const dy = y - lastMove.y;
          const d = Math.sqrt(dx * dx + dy * dy);

          if (d > 2 && d < 200) {
            const now = Date.now();
            const petHistory = petHistoryRef.current;
            petHistory.push({ dx, dy, time: now });

            // Clean history older than 600ms
            while (petHistory.length > 0 && now - petHistory[0].time > 600) {
              petHistory.shift();
            }

            // Count direction reversals on X and Y axes
            let xReversals = 0;
            let yReversals = 0;
            let lastSigX = 0;
            let lastSigY = 0;

            for (const move of petHistory) {
              if (Math.abs(move.dx) > 5) {
                const sigX = Math.sign(move.dx);
                if (lastSigX !== 0 && sigX !== lastSigX) {
                  xReversals++;
                }
                lastSigX = sigX;
              }

              if (Math.abs(move.dy) > 5) {
                const sigY = Math.sign(move.dy);
                if (lastSigY !== 0 && sigY !== lastSigY) {
                  yReversals++;
                }
                lastSigY = sigY;
              }
            }

            // Must change directions at least twice in 600ms (rubbing back and forth)
            if (xReversals >= 2 || yReversals >= 2) {
              onPet();
            }
          }
        }
      } else {
        window.electronAPI.setIgnoreMouseEvents(true, { forward: true });
      }

      lastMovePosRef.current = { x, y };
    } else {
      window.electronAPI.setIgnoreMouseEvents(true, { forward: true });
    }
  };

  const handleMouseLeave = () => {
    window.electronAPI.setIgnoreMouseEvents(true, { forward: true });
  };

  const handleMouseDown = (e) => {
    if (e.button === 0) { // Left-click
      const canvas = canvasRef.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      const x = Math.floor(((e.clientX - rect.left) / rect.width) * canvas.width);
      const y = Math.floor(((e.clientY - rect.top) / rect.height) * canvas.height);

      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      const pixel = ctx.getImageData(x, y, 1, 1).data;
      const alpha = pixel[3];

      if (alpha > 0) {
        onDragStart();
      }
    }
  };

  const handleContextMenu = (e) => {
    e.preventDefault();
    window.electronAPI.showContextMenu();
  };

  const displaySize = 128 * scale;

  // Pulse scale for rage shake — subtle bounce at high heat
  const rageScale = state === 'typing_red'
    ? 1 + Math.sin(Date.now() / 80) * 0.012 * typingHeat
    : 1;

  return (
    <div 
      className="mascot-container"
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onMouseDown={handleMouseDown}
      onContextMenu={handleContextMenu}
      style={{
        position: 'relative',
        width: `${displaySize}px`,
        height: `${displaySize}px`
      }}
    >
      <canvas
        ref={canvasRef}
        className="mascot-sprite"
        style={{
          width: `${displaySize}px`,
          height: `${displaySize}px`,
          transform: `scale(${rageScale})`,
          transition: state === 'typing_red' ? 'none' : 'transform 0.1s ease',
        }}
      />

      {/* Steam puffs rendered as white blobs above the cat's head */}
      {steamPuffs.map(p => (
        <div
          key={p.id}
          style={{
            position: 'absolute',
            left: `${p.x}px`,
            top: `${p.y}px`,
            width: `${p.size}px`,
            height: `${p.size}px`,
            borderRadius: '50%',
            background: 'white',
            opacity: p.opacity,
            pointerEvents: 'none',
            transform: 'translate(-50%, -50%)',
            filter: 'blur(2px)',
            zIndex: 3,
          }}
        />
      ))}

      {transparentHeartUrl && hearts.map((h) => (
        <img
          key={h.id}
          src={transparentHeartUrl}
          alt="purr heart"
          style={{
            position: 'absolute',
            left: `${h.x}px`,
            top: `${h.y}px`,
            width: `${16 * h.scale}px`,
            height: `${16 * h.scale}px`,
            opacity: h.opacity,
            pointerEvents: 'none',
            transform: 'translate(-50%, -50%)',
            imageRendering: 'pixelated',
          }}
        />
      ))}
    </div>
  );
}
