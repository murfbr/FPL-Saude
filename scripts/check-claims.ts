import { initializeApp, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
const projectId = process.env.VITE_FIREBASE_PROJECT_ID;

if (getApps().length === 0) {
  initializeApp({ projectId });
}

async function checkClaims() {
  const auth = getAuth();
  
  console.log('\n🔍 Lendo usuários diretos do serviço de Autenticação (Não do Firestore)...\n');
  
  const listUsersResult = await auth.listUsers(5); // Amostra de 5 usuários
  
  listUsersResult.users.forEach((userRecord) => {
    console.log(`Usuário: ${userRecord.email || userRecord.uid}`);
    console.log(`Claims Injetadas:`, userRecord.customClaims || 'Nenhuma claim encontrada');
    console.log('---------------------------------------------------');
  });
  
  process.exit(0);
}

checkClaims().catch(console.error);
