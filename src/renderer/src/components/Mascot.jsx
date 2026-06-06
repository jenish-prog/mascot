import React, { useRef, useEffect } from 'react';
import idle1 from '../assets/sprites/idle_1.png';
import idle2 from '../assets/sprites/idle_2.png';
import typing1 from '../assets/sprites/typing_1.png';
import typing2 from '../assets/sprites/typing_2.png';
import sleeping1 from '../assets/sprites/sleeping_1.png';
import sleeping2 from '../assets/sprites/sleeping_2.png';
import dragging1 from '../assets/sprites/dragging_1.png';
import hunting1 from '../assets/sprites/hunting_1.png';
import hunting2 from '../assets/sprites/hunting_2.png';

const SPRITES = {
  idle: [idle1, idle2],
  typing: [typing1, typing2],
  sleeping: [sleeping1, sleeping2],
  dragging: [dragging1],
  hunting: [hunting1, hunting2]
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

  // Filter components to find the circular eyeballs inside the upper half of the head
  const candidates = components.filter(c => {
    const aspectRatio = c.width / c.height;
    return (
      c.pixelCount > 100 && c.pixelCount < 30000 &&
      aspectRatio > 0.6 && aspectRatio < 1.6 &&
      c.centerY > height * 0.2 && c.centerY < height * 0.6 &&
      c.centerX > width * 0.15 && c.centerX < width * 0.85
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

export default function Mascot({ state, frame, scale, onDragStart }) {
  const canvasRef = useRef(null);
  const cacheCanvasRef = useRef(document.createElement('canvas'));

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
      } else {
        window.electronAPI.setIgnoreMouseEvents(true, { forward: true });
      }
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

  return (
    <div 
      className="mascot-container"
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onMouseDown={handleMouseDown}
      onContextMenu={handleContextMenu}
    >
      <canvas
        ref={canvasRef}
        className="mascot-sprite"
        style={{
          width: `${displaySize}px`,
          height: `${displaySize}px`
        }}
      />
    </div>
  );
}
