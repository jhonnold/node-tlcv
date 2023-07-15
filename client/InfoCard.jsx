import React, { useEffect } from 'react';
import { Chessboard } from 'react-chessboard';
import { getLogoUrl } from './util/logo';
import { msToString } from './util/time';

export default function InfoCard(props) {
  const [time, setTime] = React.useState(new Date().getTime());
  const [startTime, setStart] = React.useState(new Date().getTime());
  const intervalRef = React.useRef(null);

  useEffect(() => {
    if (props.active) {
      setTime(new Date().getTime());
      setStart(new Date().getTime());

      intervalRef.current = setInterval(() => {
        setTime(new Date().getTime());
      }, 1000);
    } else {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    return () => clearInterval(intervalRef.current);
  }, [props.active]);

  const printOn = props.color == 'white' ? 0 : 1;
  const pv = props.pv.flatMap((move, idx) => {
    const els = [];
    if (idx % 2 == printOn) {
      const num = props.pvMoveNumber + Math.floor((idx + printOn) / 2);
      els.push(<strong key={num}>{num}</strong>, `. ${move} `);
    } else {
      els.push(`${move} `);
    }

    return els;
  });

  if (props.color == 'black') pv.unshift(<strong key={props.pvMoveNumber}>{props.pvMoveNumber}...</strong>, ' ');

  const score = props.color == 'white' ? props.score : -props.score;

  const clockTime = msToString(props.clockTime - (props.active ? time - startTime : props.usedTime - 1000));
  const usedTime = msToString(props.active ? time - startTime : props.usedTime);

  return (
    <div className="info-area">
      <h3 className="info-name" style={{ backgroundImage: getLogoUrl(props.name) }}>
        {props.name}
      </h3>
      <div className="card fluid info-card">
        <div className="row">
          <div className="col-sm">
            <div className="row">
              <div className="col-sm info">
                <p className="small-margin">
                  <small className="info-header">Score</small>
                </p>
                <p className="small-margin info-value">{score.toFixed(2)}</p>
              </div>
              <div className="col-sm info">
                <p className="small-margin">
                  <small className="info-header">Depth</small>
                </p>
                <p className="small-margin info-value">{props.depth}</p>
              </div>
              <div className="col-sm info">
                <p className="small-margin">
                  <small className="info-header">Nodes</small>
                </p>
                <p className="small-margin info-value">{(props.nodes / 1000000).toFixed(2) + 'M'}</p>
              </div>
              <div className="col-sm info">
                <p className="small-margin">
                  <small className="info-header">Nps</small>
                </p>
                <p className="small-margin info-value">{(props.nodes / props.usedTime / 1000).toFixed(2) + 'M'}</p>
              </div>
            </div>
          </div>
          <div className="col-sm-3" style={{ textAlign: 'right' }}>
            <h3>
              <small>{props.active ? <mark>{clockTime}</mark> : clockTime}</small>
            </h3>
            <h6>
              <small>{usedTime}</small>
            </h6>
          </div>
          <div className="col-sm-12">
            <p className="pv">
              <small>{pv}</small>
            </p>
          </div>
        </div>
      </div>
      <div className="info-board">
        <Chessboard position={props.pvFen} />
      </div>
    </div>
  );
}
