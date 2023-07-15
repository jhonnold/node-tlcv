import { useCallback, useEffect, useState } from 'react';

const useOneSecond = (callback) =>
  useEffect(() => {
    const id = setInterval(callback, 1000);

    return () => clearInterval(id);
  }, [callback]);

export const useTimer = ({ seconds: initialSeconds = 0, running: initiallyRunning = false } = {}) => {
  const [seconds, setSeconds] = useState(initialSeconds);
  const [running, setRunning] = useState(initiallyRunning);

  const tick = useCallback(() => {
    if (running) setSeconds((s) => s + 1);
  }, [running]);

  const reset = () => setSeconds(0);
  const pause = () => setRunning(false);

  const start = () => {
    if (!running) {
      reset();
      setRunning(true);
    }
  };
  const stop = () => {
    pause();
  };

  useOneSecond(tick);

  return { pause, reset, running, seconds, start, stop };
};
