// Usage: GOOGLE_APPLICATION_CREDENTIALS=key.json node scripts/set-admin.mjs you@example.com
import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

initializeApp();
const email = process.argv[2];
if (!email) throw new Error('email required');
const user = await getAuth().getUserByEmail(email);
await getAuth().setCustomUserClaims(user.uid, { admin: true });
console.log(`admin claim set for ${email} (sign out and in again to refresh the token)`);
