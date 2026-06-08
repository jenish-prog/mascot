import React, { useState, useEffect, useRef } from 'react';
import Mascot from './components/Mascot.jsx';

export default function App() {
  const [state, setState] = useState('idle'); // 'idle', 'typing', 'typing_red', 'sleeping', 'dragging'
  const [frame, setFrame] = useState(0);
  const [scale, setScale] = useState(1.0);
  const [lastActivity, setLastActivity] = useState(Date.now());
  const [typingHeat, setTypingHeat] = useState(0); // 0 = calm, 1 = fully red-rage

  const typingTimeoutRef = useRef(null);
  const huntingTimeoutRef = useRef(null);
  const pettingTimeoutRef = useRef(null);
  const scrollTimeoutRef = useRef(null);
  const petIntensityRef = useRef(0);
  const stateRef = useRef(state);
  stateRef.current = state;

  // --- Typing heat tracking ---
  // Keystroke timestamps in the last 5 seconds
  const keystrokeTimesRef = useRef([]);
  const typingHeatRef = useRef(0);

  // Decay heat over time when not typing aggressively
  useEffect(() => {
    const decayInterval = setInterval(() => {
      const now = Date.now();
      // Keep only keystrokes within the last 5 seconds
      keystrokeTimesRef.current = keystrokeTimesRef.current.filter(t => now - t < 5000);

      // Keystrokes per second (5-second rolling window)
      const kps = keystrokeTimesRef.current.length / 5;

      // Target heat: 0 at 0 kps, 1.0 at 8+ kps
      const targetHeat = Math.min(kps / 8, 1.0);

      // Smooth interpolation: heat rises fast (0.12 step up), cools slowly (0.03 step down)
      const currentHeat = typingHeatRef.current;
      const delta = targetHeat > currentHeat ? 0.12 : -0.03;
      const newHeat = Math.max(0, Math.min(1, currentHeat + delta));

      typingHeatRef.current = newHeat;
      setTypingHeat(newHeat);

      // Switch state between 'typing' and 'typing_red' based on heat threshold
      const currentState = stateRef.current;
      if (currentState === 'typing' || currentState === 'typing_red') {
        if (newHeat >= 0.55 && currentState !== 'typing_red') {
          setState('typing_red');
        } else if (newHeat < 0.45 && currentState === 'typing_red') {
          setState('typing');
        }
      }
    }, 150);

    return () => clearInterval(decayInterval);
  }, []);

  // Fetch initial scale and listen for scale updates from main process context menu
  useEffect(() => {
    window.electronAPI.getScale().then((initialScale) => {
      if (initialScale) setScale(initialScale);
    });

    const removeMenuListener = window.electronAPI.onMenuCommand((command) => {
      if (command.type === 'scale') {
        setScale(command.value);
      }
    });

    return () => {
      removeMenuListener();
    };
  }, []);

  // Listen to global keystrokes via IPC to update mascot state
  useEffect(() => {
    const removeKeystrokeListener = window.electronAPI.onGlobalKeystroke(() => {
      const now = Date.now();
      setLastActivity(now);

      // Record this keystroke timestamp for heat calculation
      keystrokeTimesRef.current.push(now);

      const currentState = stateRef.current;
      
      // If typing, clear any active hunting or petting or scrolling timeouts
      if (huntingTimeoutRef.current) {
        clearTimeout(huntingTimeoutRef.current);
      }
      if (pettingTimeoutRef.current) {
        clearTimeout(pettingTimeoutRef.current);
      }
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
      petIntensityRef.current = 0;

      if (currentState === 'sleeping') {
        setState('idle');
        // Cool down heat when waking from sleep
        keystrokeTimesRef.current = [];
        typingHeatRef.current = 0;
        setTypingHeat(0);
      } else if (currentState !== 'dragging') {
        // Set base typing state; heat system will upgrade to typing_red if needed
        if (currentState !== 'typing_red') {
          setState('typing');
        }
        setFrame((f) => f + 1); // Advance frame directly on user keystroke

        if (typingTimeoutRef.current) {
          clearTimeout(typingTimeoutRef.current);
        }

        typingTimeoutRef.current = setTimeout(() => {
          const s = stateRef.current;
          if (s === 'typing' || s === 'typing_red') {
            setState('idle');
          }
        }, 1000); // Return to idle after 1.0 second of no keystrokes
      }
    });

    return () => {
      removeKeystrokeListener();
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, []);

  // Listen to global scroll/wheel events via IPC
  useEffect(() => {
    const removeScrollListener = window.electronAPI.onGlobalScroll(() => {
      const now = Date.now();
      setLastActivity(now);

      const currentState = stateRef.current;

      // Clear other timeouts
      if (huntingTimeoutRef.current) clearTimeout(huntingTimeoutRef.current);
      if (pettingTimeoutRef.current) clearTimeout(pettingTimeoutRef.current);
      petIntensityRef.current = 0;

      if (currentState === 'sleeping') {
        setState('idle');
      } else if (currentState !== 'dragging' && currentState !== 'typing' && currentState !== 'typing_red') {
        setState('scrolling');
        setFrame((f) => f + 1); // Animate scrolling on scroll wheel movement

        if (scrollTimeoutRef.current) {
          clearTimeout(scrollTimeoutRef.current);
        }

        scrollTimeoutRef.current = setTimeout(() => {
          if (stateRef.current === 'scrolling') {
            setState('idle');
          }
        }, 800); // Return to idle after 800ms of no scrolling
      }
    });

    return () => {
      removeScrollListener();
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, []);

  // Listen to global cursor movements to detect "rubbing/shaking" and trigger hunting state
  useEffect(() => {
    let lastPos = null;
    let lastTime = Date.now();
    const moveHistory = []; // Array of { dx, dy, time }

    const removeCursorListener = window.electronAPI.onGlobalCursor(({ cursor }) => {
      const now = Date.now();
      const dt = now - lastTime;

      if (lastPos && dt > 10) {
        const dx = cursor.x - lastPos.x;
        const dy = cursor.y - lastPos.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        // Record significant movements
        if (dist > 15) {
          moveHistory.push({ dx, dy, time: now });
        }

        // Keep rolling history of last 500ms
        const windowDuration = 500;
        while (moveHistory.length > 0 && now - moveHistory[0].time > windowDuration) {
          moveHistory.shift();
        }

        // Count direction reversals on X and Y axes
        let xReversals = 0;
        let yReversals = 0;
        let lastSigX = 0;
        let lastSigY = 0;

        for (const move of moveHistory) {
          if (Math.abs(move.dx) > 10) {
            const sigX = Math.sign(move.dx);
            if (lastSigX !== 0 && sigX !== lastSigX) {
              xReversals++;
            }
            lastSigX = sigX;
          }

          if (Math.abs(move.dy) > 10) {
            const sigY = Math.sign(move.dy);
            if (lastSigY !== 0 && sigY !== lastSigY) {
              yReversals++;
            }
            lastSigY = sigY;
          }
        }

        // Rubbing is rapid back-and-forth movement (>= 3 direction reversals in 500ms)
        const isRubbing = xReversals >= 3 || yReversals >= 3;

        // If rubbing is detected and we aren't dragging or sleeping
        if (isRubbing && stateRef.current !== 'dragging' && stateRef.current !== 'sleeping') {
          setState('hunting');
          setLastActivity(now);

          if (typingTimeoutRef.current) {
            clearTimeout(typingTimeoutRef.current);
          }

          if (huntingTimeoutRef.current) {
            clearTimeout(huntingTimeoutRef.current);
          }

          if (pettingTimeoutRef.current) {
            clearTimeout(pettingTimeoutRef.current);
          }
          petIntensityRef.current = 0;

          huntingTimeoutRef.current = setTimeout(() => {
            if (stateRef.current === 'hunting') {
              setState('idle');
            }
          }, 2000); // Return to idle after 2.0s of no rubbing
        }
      }

      lastPos = cursor;
      lastTime = now;
    });

    return () => {
      removeCursorListener();
      if (huntingTimeoutRef.current) {
        clearTimeout(huntingTimeoutRef.current);
      }
    };
  }, []);

  // Monitor inactivity to trigger Sleeping state after 30 seconds of idle
  useEffect(() => {
    const inactivityTimer = setInterval(() => {
      const now = Date.now();
      if (state === 'idle' && now - lastActivity > 30000) {
        setState('sleeping');
        // Cool down heat when going to sleep
        keystrokeTimesRef.current = [];
        typingHeatRef.current = 0;
        setTypingHeat(0);
      }
    }, 1000);

    return () => clearInterval(inactivityTimer);
  }, [state, lastActivity]);

  // Adjust tick rate (animation speed) based on the active state
  useEffect(() => {
    // Only reset frame if transitioning to a non-typing/non-scrolling state
    if (state !== 'typing' && state !== 'typing_red' && state !== 'scrolling') {
      setFrame(0);
    }
    
    // Freeze automatic frames while dragging, typing, or scrolling
    if (state === 'dragging' || state === 'typing' || state === 'typing_red' || state === 'scrolling') return;

    const getTickRate = () => {
      if (state === 'sleeping') return 800;
      if (state === 'hunting') return 200; // Faster frame shifts during hunting
      if (state === 'petting') return 300; // Gentle purring vibration
      return 500; // idle
    };

    const ticker = setInterval(() => {
      setFrame((f) => f + 1);
    }, getTickRate());

    return () => clearInterval(ticker);
  }, [state]);

  const handlePet = () => {
    const now = Date.now();
    setLastActivity(now);

    const currentState = stateRef.current;
    if (currentState === 'sleeping') {
      setState('idle'); // Wake up from sleep on pet
      return;
    }

    if (currentState === 'dragging') return;

    // Transition immediately to petting state when rubbing is detected
    if (currentState !== 'petting') {
      setState('petting');
    }

    // Extend petting duration
    if (pettingTimeoutRef.current) {
      clearTimeout(pettingTimeoutRef.current);
    }

    pettingTimeoutRef.current = setTimeout(() => {
      petIntensityRef.current = 0;
      if (stateRef.current === 'petting') {
        setState('idle');
      }
    }, 1500); // Return to idle 1.5s after petting stops
  };

  const handleDragStart = () => {
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    if (huntingTimeoutRef.current) {
      clearTimeout(huntingTimeoutRef.current);
    }
    if (pettingTimeoutRef.current) {
      clearTimeout(pettingTimeoutRef.current);
    }
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
    }
    petIntensityRef.current = 0;

    setState('dragging');
    setLastActivity(Date.now());
    window.electronAPI.dragStart();

    // Setup global mouse up tracking to release the window drag
    const handleMouseUp = () => {
      window.electronAPI.dragEnd();
      setState('idle');
      setLastActivity(Date.now());
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mouseup', handleMouseUp);
  };

  return (
    <Mascot
      state={state}
      frame={frame}
      scale={scale}
      typingHeat={typingHeat}
      onDragStart={handleDragStart}
      onPet={handlePet}
    />
  );
}
