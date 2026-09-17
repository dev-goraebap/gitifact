import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { AppProviders } from '../providers/AppProviders';
import '../styles/global.css';
import { t } from '../../shared/i18n';

const root = document.getElementById('root');
if (!root) throw new Error(t('app.rootMissing'));

createRoot(root).render(
  <StrictMode>
    <AppProviders />
  </StrictMode>,
);
