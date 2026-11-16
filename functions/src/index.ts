import { initializeApp } from 'firebase-admin/app';

initializeApp();

export { submitReport } from './submit';
export { adminApi } from './admin';
export { subscribeAlerts } from './alerts';
