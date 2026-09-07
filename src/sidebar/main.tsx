import React from 'react';
import ReactDOM from 'react-dom/client';
import { SidebarApp } from './SidebarApp';
import '../shared/theme.css';
import './sidebar.css';
import './settings-fix.css';
import './composer-fix.css';
import './markdown.css';
import './evidence.css';

ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode><SidebarApp /></React.StrictMode>);
