import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';

// Inicialização: Certifique-se de baixar o serviceAccountKey.json do Firebase e colocar na pasta raiz
const serviceAccount = JSON.parse(readFileSync('./serviceAccountKey.json', 'utf8'));

initializeApp({
  credential: cert(serviceAccount)
});

const db = getFirestore();

// Se houver mais de uma empresa, você precisará iterar ou passar o ID.
// Por padrão, a maioria dos sistemas usa 'default' ou outro ID conhecido.
// Troque pelo ID da sua empresa se necessário.
const COMPANY_ID = 'default'; 

async function cleanDuplicatePayments() {
  console.log('Iniciando varredura de pagamentos duplicados...');
  const finRef = db.collection('companies').doc(COMPANY_ID).collection('financial_records');
  
  // Pegamos todos os pagamentos que são referentes a uma assinatura
  const snapshot = await finRef.where('client_subscription_id', '!=', null).get();
  
  if (snapshot.empty) {
    console.log('Nenhum registro financeiro de assinatura encontrado.');
    return;
  }

  // Agrupamento: subscriptionId -> monthYear (YYYY-MM) -> array of docs
  const groupedPayments = {};

  snapshot.forEach(doc => {
    const data = doc.data();
    if (!data.payment_date || !data.client_subscription_id) return;

    const subId = data.client_subscription_id;
    // O payment_date armazena a competência (geralmente salva com new Date().toISOString() ou a data passada)
    // Extraímos apenas o ano e mês: "2026-05"
    const monthYear = data.payment_date.substring(0, 7);

    if (!groupedPayments[subId]) {
      groupedPayments[subId] = {};
    }
    if (!groupedPayments[subId][monthYear]) {
      groupedPayments[subId][monthYear] = [];
    }

    groupedPayments[subId][monthYear].push({ id: doc.id, ...data });
  });

  let duplicateCount = 0;

  for (const [subId, months] of Object.entries(groupedPayments)) {
    for (const [monthYear, records] of Object.entries(months)) {
      if (records.length > 1) {
        // Ordena para manter o mais antigo (presumindo que foi a primeira tentativa real)
        records.sort((a, b) => a.payment_date.localeCompare(b.payment_date));
        
        // Separa o primeiro (que vai ficar) dos restantes (que serão excluídos)
        const [keep, ...duplicates] = records;
        
        console.log(`Assinatura ${subId} no mês ${monthYear} tem ${records.length} pagamentos. Mantendo 1, excluindo ${duplicates.length}.`);
        
        for (const dup of duplicates) {
          console.log(` -> Excluindo registro duplicado: ${dup.id} (R$ ${dup.amount})`);
          await finRef.doc(dup.id).delete();
          duplicateCount++;
        }
      }
    }
  }

  console.log(`Varredura concluída. Foram removidos ${duplicateCount} registros duplicados.`);
}

cleanDuplicatePayments().catch(console.error);
