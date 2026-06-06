import './design/reset.css';
import './design/fonts.css';
import './design/variables.css';
import { createRoot } from 'react-dom/client';
import { StrictMode } from 'react';
import { App } from './App';

const root = createRoot(document.getElementById('root')!);
root.render(<StrictMode><App /></StrictMode>);
