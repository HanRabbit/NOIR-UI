import React from 'react';
import {createRoot} from 'react-dom/client';
import {initTheme} from '../src/index.js';
import App from './App.jsx';
import './docs.css';

initTheme();
createRoot(document.getElementById('root')).render(<React.StrictMode><App/></React.StrictMode>);
