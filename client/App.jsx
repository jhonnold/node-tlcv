import React from 'react';
import { useParams } from 'react-router-dom';
import { Chessboard } from 'react-chessboard';
import { socket } from './socket';
import InfoCard from './InfoCard';

function App() {
  const { port } = useParams();
  const [data, setData] = React.useState();
  const [chat, setChat] = React.useState([]);

  React.useEffect(() => {
    const onConnect = () => socket.emit('join', { port: +port, user: 'Me!' });
    const onState = (data) => {
      setChat(data.chat);
      setData({ ...data, chat: undefined });
    };
    const onUpdate = (data) => setData(data);
    const onChat = (data) => setChat((chat) => [...chat, ...data]);

    socket.on('connect', onConnect);
    socket.on('state', onState);
    socket.on('update', onUpdate);
    socket.on('new-chat', onChat);
    socket.connect();

    return () => {
      socket.off('connect', onConnect);
      socket.off('state', onState);
      socket.off('update', onUpdate);
      socket.off('new-chat', onChat);
      socket.disconnect();
    };
  }, []);

  if (!data) return null;

  return (
    <div className="container">
      <div className="main-layout">
        <InfoCard {...data.game.black} color="black" active={data.game.stm == 'b'} />
        <div id="board-container">
          <canvas id="arrow-board" height="2400" width="2400"></canvas>
          <Chessboard id="board" position={data.game.fen} />
        </div>
        <div className="below-board">
          <div id="fen-tooltip" className="tooltip" aria-label="Click to copy">
            <pre id="fen">{data.game.fen}</pre>
          </div>
          <pre id="caption">
            {data.game.tablebase ? `Tablebase: ${data.game.tablebase}` : `Opening: ${data.game.opening}`}
          </pre>
        </div>
        <InfoCard {...data.game.white} color="white" active={data.game.stm == 'w'} />
        <div id="chat-area">
          <div className="card fluid" id="chat-box"></div>
          <input placeholder="Anonymous" id="username" />
          <ul className="card fluid" id="spectator-box"></ul>
          <input placeholder="Type your message here..." id="chat-msg" />
          <button className="primary" id="chat-btn">
            Send
          </button>
        </div>
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
          <a href="https://ccrl.chessdom.com/ccrl/4040/">Graham Banks, CCRL</a>. Hosting and Development by
          <a href="https://github.com/jhonnold">Jay Honnold</a>. Have a question, recommendation, or concern? Reach out{' '}
          <a href="https://github.com/jhonnold/node-tlcv/issues">here</a>.
        </small>
      </h6>
      <h6 className="other">
        <a id="theme-dark" className="primary button theme-btn">
          Switch to dark theme
        </a>
        <a id="theme-light" className="primary button theme-btn">
          Switch to light theme
        </a>
      </h6>
    </div>
  );
}

export default App;
