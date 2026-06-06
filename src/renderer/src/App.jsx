import React, { useState, useEffect, useRef } from 'react';
import Mascot from './components/Mascot.jsx';

export default function App() {
  const [state, setState] = useState('idle'); // 'idle', 'typing', 'sleeping', 'dragging'
  const [frame, setFrame] = useState(0);
  const [scale, setScale] = useState(1.0);
  const [lastActivity, setLastActivity] = useState(Date.now());

  const typingTimeoutRef = useRef(null);
  const stateRef = useRef(state);
  stateRef.current = state;

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

      const currentState = stateRef.current;
      if (currentState === 'sleeping') {
        setState('idle');
      } else if (currentState !== 'dragging') {
        setState('typing');

        if (typingTimeoutRef.current) {
          clearTimeout(typingTimeoutRef.current);
        }

        typingTimeoutRef.current = setTimeout(() => {
          if (stateRef.current === 'typing') {
            setState('idle');
          }
        }, 1500); // Stop typing animation after 1.5s of no keystrokes
      }
    });

    return () => {
      removeKeystrokeListener();
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, []);

  // Monitor inactivity to trigger Sleeping state after 30 seconds of idle
  useEffect(() => {
    const inactivityTimer = setInterval(() => {
      const now = Date.now();
      if (state === 'idle' && now - lastActivity > 30000) {
        setState('sleeping');
      }
    }, 1000);

    return () => clearInterval(inactivityTimer);
  }, [state, lastActivity]);

  // Adjust tick rate (animation speed) based on the active state
  useEffect(() => {
    setFrame(0); // Reset frame on state change for smooth initial render
    
    if (state === 'dragging') return; // Freeze frames while dragging

    const getTickRate = () => {
      if (state === 'typing') return 150;
      if (state === 'sleeping') return 800;
      return 500; // idle
    };

    const ticker = setInterval(() => {
      setFrame((f) => f + 1);
    }, getTickRate());

    return () => clearInterval(ticker);
  }, [state]);

  const handleDragStart = () => {
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
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
      onDragStart={handleDragStart}
    />
  );
}
