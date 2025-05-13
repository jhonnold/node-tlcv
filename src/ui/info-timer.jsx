import { useState, useEffect } from 'react';

function msToString(ms) {
  const s = Math.floor((ms / 1000) % 60);
  const m = Math.floor(ms / 1000 / 60);

  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function InfoTimer(props) {
  const { active, initialTime } = props;
  const [time, setTime] = useState(initialTime);

  useEffect(() => {
    if (active) {
      const intervalId = setInterval(() => {
        setTime((prevTime) => prevTime - 1000);
      }, 1000);

      return () => clearInterval(intervalId);
    }

    return () => {};
  }, [active]);

  return (
    <div className="col-sm-3" style={{ textAlign: 'right' }}>
      <h3>
        <small>{active ? <mark>{msToString(Math.max(0, time))}</mark> : msToString(Math.max(0, time))}</small>
      </h3>
      <h6>
        <small>{msToString(initialTime - time)}</small>
      </h6>
    </div>
  );
}

export default InfoTimer;
