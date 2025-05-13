import { Chessboard } from 'react-chessboard';
import InfoTimer from './info-timer';

function InfoCard(props) {
  const { player, color, stm } = props;
  const { name, score, depth, nodes, usedTime, pvFen, pvMoveNumber, pv, clockTime } = player;

  let relativeScore = score * -1;
  if (relativeScore > 100000) relativeScore = 'M';
  else if (relativeScore < -100000) relativeScore = '-M';

  const printOn = color === 'white' ? 0 : 1;

  const pvElements = pv.reduce(
    (h, move, idx) => {
      if (idx % 2 === printOn) {
        const moveNumber = pvMoveNumber + Math.floor((idx + printOn) / 2);
        h.push(<strong>{moveNumber}. </strong>);
      }

      h.push(<span>{move} </span>);
      return h;
    },
    color === 'white' ? [] : [<strong>{pvMoveNumber}...</strong>],
  );

  return (
    <div className="info-area">
      <h3 className="info-name">{name}</h3>
      <div className="card fluid info-card">
        <div className="row">
          <div className="col-sm">
            <div className="row">
              <div className="col-sm info">
                <p className="small-margin">
                  <small className="info-header">Score</small>
                </p>
                <p className="small-margin info-value">{relativeScore.toFixed(2)}</p>
              </div>
              <div className="col-sm info">
                <p className="small-margin">
                  <small className="info-header">Depth</small>
                </p>
                <p className="small-margin info-value">{depth}</p>
              </div>
              <div className="col-sm info">
                <p className="small-margin">
                  <small className="info-header">Nodes</small>
                </p>
                <p className="small-margin info-value">{(nodes / 1000000).toFixed(2)}M</p>
              </div>
              <div className="col-sm info">
                <p className="small-margin">
                  <small className="info-header">Nps</small>
                </p>
                <p className="small-margin info-value">{(nodes / usedTime / 1000).toFixed(2)}M</p>
              </div>
            </div>
          </div>
          <InfoTimer initialTime={clockTime} active={color.startsWith(stm)} />
          <div className="col-sm-12">
            <p className="pv">
              <small>{pvElements}</small>
            </p>
          </div>
        </div>
      </div>
      <div className="info-board">
        <Chessboard position={pvFen} animationDuration={0} />
      </div>
    </div>
  );
}

export default InfoCard;
