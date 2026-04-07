/**
 * clawflow Web UI 入口
 */
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles/index.css';

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('找不到 #root 掛載點');
}

const root = createRoot(rootElement);
root.render(<App />);
