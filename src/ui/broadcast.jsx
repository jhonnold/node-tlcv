import { useParams } from 'react-router';

function Broadcast() {
  const { port } = useParams();

  return <h1>{port}</h1>;
}

export default Broadcast;
