import React from 'react';
import ReactDOM from 'react-dom/client';
import { KnowledgeApp } from './KnowledgeApp';
import '../shared/theme.css';
import './knowledge.css';
import './markdown.css';

ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode><KnowledgeApp /></React.StrictMode>);
