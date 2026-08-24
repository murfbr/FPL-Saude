import { db } from '@/shared/lib/firebase'
import {
  collection,
  doc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  writeBatch,
} from 'firebase/firestore'
import { format } from 'date-fns'
import { Expense, ExpenseCategory } from '@/shared/types'
import { getCompanyId } from '@/shared/lib/tenantStore'
import { monthRangeUtc } from '@/shared/lib/spTime'

/**
 * Categorias padrão semeadas na primeira abertura da tela (IDs determinísticos:
 * re-semear nunca duplica). CRUD liberado — cada clínica ajusta à sua realidade.
 */
const DEFAULT_CATEGORIES: { id: string; name: string }[] = [
  { id: 'aluguel', name: 'Aluguel' },
  { id: 'salarios', name: 'Salários' },
  { id: 'repasses', name: 'Repasses a Profissionais' },
  { id: 'materiais', name: 'Materiais e Insumos' },
  { id: 'impostos', name: 'Impostos e Taxas' },
  { id: 'marketing', name: 'Marketing' },
  { id: 'equipamentos', name: 'Equipamentos' },
  { id: 'contas-consumo', name: 'Contas (Água/Luz/Internet)' },
  { id: 'outros', name: 'Outros' },
]

export async function getExpenseCategories(): Promise<{
  data: ExpenseCategory[] | null
  error: any
}> {
  try {
    const ref = collection(
      db,
      'companies',
      getCompanyId(),
      'expense_categories',
    )
    let snap = await getDocs(ref)

    if (snap.empty) {
      const batch = writeBatch(db)
      const now = new Date().toISOString()
      for (const cat of DEFAULT_CATEGORIES) {
        batch.set(doc(ref, cat.id), {
          id: cat.id,
          name: cat.name,
          is_active: true,
          created_at: now,
        })
      }
      await batch.commit()
      snap = await getDocs(ref)
    }

    const cats = snap.docs
      .map((d) => ({ id: d.id, ...d.data() }) as ExpenseCategory)
      .filter((c) => c.is_active !== false)
      .sort((a, b) => a.name.localeCompare(b.name))
    return { data: cats, error: null }
  } catch (error) {
    console.error('[getExpenseCategories]', error)
    return { data: null, error }
  }
}

export async function createExpenseCategory(
  name: string,
): Promise<{ data: ExpenseCategory | null; error: any }> {
  try {
    const ref = doc(
      collection(db, 'companies', getCompanyId(), 'expense_categories'),
    )
    const cat: ExpenseCategory = {
      id: ref.id,
      name: name.trim(),
      is_active: true,
      created_at: new Date().toISOString(),
    }
    await setDoc(ref, cat)
    return { data: cat, error: null }
  } catch (error) {
    return { data: null, error }
  }
}

export async function getSuppliers(): Promise<{ data: string[]; error: any }> {
  try {
    const snap = await getDocs(
      collection(db, 'companies', getCompanyId(), 'suppliers'),
    )
    const names = snap.docs
      .map((d) => (d.data().name as string) || '')
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b))
    return { data: names, error: null }
  } catch (error) {
    return { data: [], error }
  }
}

/** Cadastro leve: salva o fornecedor digitado para sugerir da próxima vez. */
async function rememberSupplier(name: string | null | undefined) {
  const trimmed = (name || '').trim()
  if (!trimmed) return
  // Slug interno do fornecedor: acentos viram '-' junto com os demais
  // não-alfanuméricos — colisão improvável e sem custo real (merge por nome)
  const id = trimmed
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
  if (!id) return
  try {
    await setDoc(
      doc(db, 'companies', getCompanyId(), 'suppliers', id),
      { id, name: trimmed, created_at: new Date().toISOString() },
      { merge: true },
    )
  } catch {
    // Sugestão de fornecedor é conveniência — falha não bloqueia a despesa
  }
}

/**
 * Despesas do mês: vencimento no mês (due_date, data de calendário) OU
 * pagamento no mês (payment_date, janela SP) — união sem duplicatas.
 */
export async function getExpensesForMonth(
  month: Date,
): Promise<{ data: Expense[] | null; error: any }> {
  try {
    const monthKey = format(month, 'yyyy-MM')
    const ref = collection(db, 'companies', getCompanyId(), 'expenses')
    const { startIso, endIso } = monthRangeUtc(monthKey)

    const [byDue, byPayment] = await Promise.all([
      getDocs(
        query(
          ref,
          where('due_date', '>=', `${monthKey}-01`),
          where('due_date', '<=', `${monthKey}-31`),
        ),
      ),
      getDocs(
        query(
          ref,
          where('payment_date', '>=', startIso),
          where('payment_date', '<=', endIso),
        ),
      ),
    ])

    const map = new Map<string, Expense>()
    byDue.forEach((d) => map.set(d.id, { id: d.id, ...d.data() } as Expense))
    byPayment.forEach((d) =>
      map.set(d.id, { id: d.id, ...d.data() } as Expense),
    )

    const list = Array.from(map.values()).sort((a, b) =>
      a.due_date.localeCompare(b.due_date),
    )
    return { data: list, error: null }
  } catch (error) {
    console.error('[getExpensesForMonth]', error)
    return { data: null, error }
  }
}

export interface ExpenseInput {
  description: string
  amount: number
  category_id: string | null
  category_name: string | null
  supplier_name: string | null
  due_date: string
  is_recurring: boolean
  payment_method?: string | null
  notes?: string | null
  /** true = já nasce paga (pagamento à vista) */
  paid_now?: boolean
}

export async function createExpense(
  input: ExpenseInput,
  createdBy?: string,
): Promise<{ data: Expense | null; error: any }> {
  try {
    const ref = doc(collection(db, 'companies', getCompanyId(), 'expenses'))
    const expense: Expense = {
      id: ref.id,
      description: input.description.trim(),
      amount: Math.max(0, input.amount),
      category_id: input.category_id,
      category_name: input.category_name,
      supplier_name: (input.supplier_name || '').trim() || null,
      status: input.paid_now ? 'paid' : 'pending',
      due_date: input.due_date,
      payment_date: input.paid_now ? new Date().toISOString() : null,
      payment_method: input.payment_method || null,
      is_recurring: input.is_recurring,
      recurrence_source_id: null,
      notes: input.notes || null,
      created_at: new Date().toISOString(),
      created_by: createdBy || null,
    }
    await setDoc(ref, expense)
    await rememberSupplier(input.supplier_name)
    return { data: expense, error: null }
  } catch (error) {
    return { data: null, error }
  }
}

export async function updateExpense(
  expenseId: string,
  updates: Partial<ExpenseInput>,
): Promise<{ error: any }> {
  try {
    const ref = doc(db, 'companies', getCompanyId(), 'expenses', expenseId)
    const payload: Record<string, unknown> = { ...updates }
    delete payload.paid_now
    if (typeof updates.amount === 'number') {
      payload.amount = Math.max(0, updates.amount)
    }
    await updateDoc(ref, payload)
    await rememberSupplier(updates.supplier_name)
    return { error: null }
  } catch (error) {
    return { error }
  }
}

export async function payExpense(
  expenseId: string,
  paymentMethod?: string | null,
): Promise<{ error: any }> {
  try {
    await updateDoc(
      doc(db, 'companies', getCompanyId(), 'expenses', expenseId),
      {
        status: 'paid',
        payment_date: new Date().toISOString(),
        payment_method: paymentMethod || null,
      },
    )
    return { error: null }
  } catch (error) {
    return { error }
  }
}

/** Desfaz o pagamento: volta a pendente (o trigger decrementa o agregado). */
export async function unpayExpense(expenseId: string): Promise<{ error: any }> {
  try {
    await updateDoc(
      doc(db, 'companies', getCompanyId(), 'expenses', expenseId),
      {
        status: 'pending',
        payment_date: null,
      },
    )
    return { error: null }
  } catch (error) {
    return { error }
  }
}

export async function deleteExpense(
  expenseId: string,
): Promise<{ error: any }> {
  try {
    await deleteDoc(doc(db, 'companies', getCompanyId(), 'expenses', expenseId))
    return { error: null }
  } catch (error) {
    return { error }
  }
}
