import { useEffect, useState } from 'react';
import { useParams } from 'react-router';
import { Chessboard } from 'react-chessboard';
import Chat from './chat';
import InfoCard from './info';
import socket from './socket';

function Broadcast() {
  const { port } = useParams();
  const [board, setBoard] = useState({});
  const [chat, setChat] = useState([]);

  useEffect(() => {
    const onState = (data) => {
      setBoard({ ...data, chat: undefined });
      setChat(data.chat);
    };

    const onUpdate = (data) => {
      setBoard(data);
    };

    const onChat = (data) => {
      setChat((c) => [...c, data]);
    };

    socket.on('state', onState);
    socket.on('update', onUpdate);
    socket.on('new-chat', onChat);

    return () => {
      socket.off('state', onState);
      socket.off('update', onUpdate);
      socket.off('new-chat', onChat);
    };
  }, []);

  useEffect(() => {
    socket.emit('join', { port: +port, user: 'testing' });

    return () => {
      socket.emit('leave', { port: +port, user: 'testing' });
    };
  }, [port]);

  const { game = {}, spectators = [] } = board;

  return (
    <div className="container">
      <div className="main-layout">
        {game.black && <InfoCard player={game.black} color="black" stm={game.stm} />}
        <div id="board-container">
          <canvas id="arrow-board" height="2400" width="2400" />
          <Chessboard position={game.fen} />
        </div>
        <div className="below-board">
          <div id="fen-tooltip" className="tooltip" aria-label="Click to copy">
            <pre id="fen">{game.fen}</pre>
          </div>
          <pre id="caption">{game.tablebase ? `Tablebase: ${game.tablebase}` : `Opening: ${game.opening}`}</pre>
        </div>
        {game.white && <InfoCard player={game.white} color="white" stm={game.stm} />}
        <Chat messages={chat} spectators={spectators} />
        <div id="button-container" className="row">
          <a href="/pgns" target="_blank" className="primary button">
            PGNS
          </a>
          <a href="/<%= port %>/pgn" target="_blank" className="primary button">
            PGN
          </a>
          <a href="/<%= port %>/result-table" target="_blank" className="primary button">
            Results
          </a>
        </div>
      </div>
      <h6 className="credits">
        <small>
          Chessboard by <a href="https://chessboardjs.com/">chessboard.js</a>. Chess pieces by
          <a href="https://en.wikipedia.org/wiki/User:Cburnett">Cburnett</a>. Broadcasts by
          <a href="https://computerchess.org.uk/ccrl/4040/">Graham Banks, CCRL</a>. Hosting and Development by
          <a href="https://github.com/jhonnold">Jay Honnold</a>. Have a question, recommendation, or concern? Reach out{' '}
          <a href="https://github.com/jhonnold/node-tlcv/issues">here</a>.
        </small>
      </h6>
      <h6 className="other">
        <button type="button" id="theme-dark" className="primary button theme-btn" style={{ display: 'none' }}>
          Switch to dark theme
        </button>
        <button type="button" id="theme-light" className="primary button theme-btn" style={{ display: 'none' }}>
          Switch to light theme
        </button>
      </h6>
    </div>
  );
}

export default Broadcast;
