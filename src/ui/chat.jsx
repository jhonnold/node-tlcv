function Chat(props) {
  const { messages, spectators } = props;

  return (
    <div id="chat-area">
      <div className="card fluid" id="chat-box">
        {messages.map((msg) => {
          let name = msg;
          let rest = '';

          if (msg.startsWith('[ccrl.live')) {
            const res = /\[(.*)\]\s+-\s+\((.*?)\)\s+(.*)/i.exec(msg);
            if (res) {
              name = `[${res[2]}] `;
              [, , , rest] = res;
            }
          } else {
            const res = /\[(.*?)\]\s+-\s+(.*)/i.exec(msg);
            if (res) {
              name = `[${res[1]}] `;
              [, , rest] = res;
            }
          }

          return (
            <p key={msg}>
              <strong>{name}</strong>
              {rest}
            </p>
          );
        })}
      </div>
      <input placeholder="Anonymous" id="username" />
      <ul className="card fluid" id="spectator-box">
        {spectators.sort().map((name) => (
          <li key={name}>
            <p>{name}</p>
          </li>
        ))}
      </ul>
      <input placeholder="Type your message here..." id="chat-msg" />
      <button type="submit" className="primary" id="chat-btn">
        Send
      </button>
    </div>
  );
}

export default Chat;
