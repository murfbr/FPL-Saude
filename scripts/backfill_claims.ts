import { initializeApp, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Carregar variáveis de ambiente se estiver local, no Vercel elas já são injetadas
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const projectId = process.env.VITE_FIREBASE_PROJECT_ID;

if (getApps().length === 0) {
  if (!projectId) {
    console.error('❌ VITE_FIREBASE_PROJECT_ID não encontrado no ambiente do Vercel/.env.local');
    process.exit(1);
  }
  
  console.log(`✅ Inicializando Firebase Admin com Project ID: ${projectId}...`);
  initializeApp({ projectId });
}

const db = getFirestore();
const auth = getAuth();

async function backfillClaims() {
  console.log('Iniciando backfill de Custom Claims para todos os usuários...');
  
  let count = 0;
  let errors = 0;

  try {
    const usersSnapshot = await db.collection('users').get();
    console.log(`Encontrados ${usersSnapshot.size} usuários no banco de dados.`);

    for (const doc of usersSnapshot.docs) {
      const data = doc.data();
      const uid = doc.id;
      
      const companyId = data.companyId;
      const role = data.role;

      if (!companyId || !role) {
        console.warn(`[WARN] Usuário ${uid} sem companyId ou role. Ignorando.`);
        continue;
      }

      try {
        const userRecord = await auth.getUser(uid);
        const currentClaims = userRecord.customClaims || {};

        if (currentClaims.companyId === companyId && currentClaims.role === role) {
          console.log(`[SKIP] Usuário ${uid} já possui as claims corretas.`);
          continue;
        }

        const claimsToSet = {
          ...currentClaims,
          companyId,
          role,
        };

        await auth.setCustomUserClaims(uid, claimsToSet);
        console.log(`[OK] Claims atualizadas para ${uid}:`, claimsToSet);
        count++;
      } catch (authErr: any) {
        if (authErr.code === 'auth/user-not-found') {
          console.warn(`[WARN] Usuário ${uid} existe no Firestore mas não no Auth.`);
        } else {
          console.error(`[ERROR] Falha ao atualizar Auth para o usuário ${uid}:`, authErr);
          errors++;
        }
      }
    }

    console.log('\n=======================================');
    console.log('Backfill finalizado!');
    console.log(`Total de usuários atualizados: ${count}`);
    console.log(`Total de erros: ${errors}`);
    console.log('=======================================');

  } catch (error) {
    console.error('Erro geral durante o backfill:', error);
  }
}

// Executar script
backfillClaims()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));
