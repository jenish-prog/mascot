import { useState, useEffect } from 'react';

export default function useMascotState() {
  const [mascotState, setMascotStateInternal] = useState('idle');

  useEffect(() => {
    const listener = (event, state) => {
      setMascotStateInternal(state);
    };

    if (window.electron && window.electron.ipcRenderer) {
      window.electron.ipcRenderer.on('mascot-state', listener);
    }

    return () => {
      if (window.electron && window.electron.ipcRenderer) {
        window.electron.ipcRenderer.removeListener('mascot-state', listener);
      }
    };
  }, []);

  const setMascotState = (state) => {
    if (window.electron && window.electron.ipcRenderer) {
      window.electron.ipcRenderer.send('mascot-state-set', state);
    } else {
      setMascotStateInternal(state);
    }
  };

  return { mascotState, setMascotState };
}
