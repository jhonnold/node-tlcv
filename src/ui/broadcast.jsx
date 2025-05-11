import { useEffect, useState } from 'react';
import { useParams } from 'react-router';
import socket from './socket';

function Broadcast() {
  const { port } = useParams();
  const [, setBoard] = useState({});
  const [, setChat] = useState([]);

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
    socket.emit('join', { port, user: 'testing' });

    return () => {
      socket.emit('leave', { port, user: 'testing' });
    };
  }, [port]);

  return <h1>{port}</h1>;
}

export default Broadcast;
