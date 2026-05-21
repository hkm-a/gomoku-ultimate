import './style.css';
import { UIManager } from './ui/UIManager';

const app = document.getElementById('app');
if (!app) {
  throw new Error('App root not found');
}

const ui = new UIManager(app);

// Expose for debugging
(window as any).__gomoku = { ui };
