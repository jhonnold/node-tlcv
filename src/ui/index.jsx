import { createRoot } from 'react-dom/client';
import { HashRouter, Routes, Route } from 'react-router';
import Broadcast from './broadcast';

const container = document.getElementById('root');
const root = createRoot(container);

root.render(
  <HashRouter>
    <Routes>
      <Route index path=":port" element={<Broadcast />} />
    </Routes>
  </HashRouter>
)
