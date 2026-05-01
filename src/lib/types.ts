// src/lib/types.ts
export interface Transaction {
  id: string
  type: 'income' | 'expense'
  amount: string
  description: string | null
  categoryId: string | null
  occurredAt: Date
  createdAt: Date
}

export interface Category {
  id: string
  name: string
  color: string | null
  createdAt: Date
}

export interface Budget {
  id: string
  categoryId: string
  amount: string
  period: 'monthly' | 'yearly'
  createdAt: Date
}

export interface BudgetWithUtilization extends Budget {
  spent: string
  remaining: string
  utilizationPercentage: number
}
