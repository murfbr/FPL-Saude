import { describe, expect, it } from 'vitest'
import {
  isStaffRole,
  getHomeRoute,
  getRoleLabel,
  listAssignableRoles,
} from '@/shared/lib/roles'

describe('isStaffRole', () => {
  it('reconhece os papéis de equipe padrão', () => {
    expect(isStaffRole('professional')).toBe(true)
    expect(isStaffRole('admin')).toBe(true)
  })

  it('reconhece papéis customizados criados na matriz da empresa', () => {
    expect(isStaffRole('coordenador')).toBe(true)
    expect(isStaffRole('secretaria')).toBe(true)
  })

  it('nega cliente, super_admin e ausência de papel', () => {
    expect(isStaffRole('client')).toBe(false)
    expect(isStaffRole('super_admin')).toBe(false)
    expect(isStaffRole(null)).toBe(false)
    expect(isStaffRole(undefined)).toBe(false)
    expect(isStaffRole('')).toBe(false)
  })
})

describe('getHomeRoute', () => {
  it('mantém as homes dos papéis originais', () => {
    expect(getHomeRoute('super_admin')).toBe('/super-admin')
    expect(getHomeRoute('admin')).toBe('/admin')
    expect(getHomeRoute('professional')).toBe('/profissional')
    expect(getHomeRoute('client')).toBe('/cliente-indisponivel')
  })

  it('manda papéis staff customizados para o portal do profissional', () => {
    expect(getHomeRoute('coordenador')).toBe('/profissional')
  })

  it('trata papel ausente como área indisponível', () => {
    expect(getHomeRoute(null)).toBe('/cliente-indisponivel')
    expect(getHomeRoute(undefined)).toBe('/cliente-indisponivel')
  })
})

describe('getRoleLabel', () => {
  it('traduz os papéis padrão', () => {
    expect(getRoleLabel('admin')).toBe('Administrador')
    expect(getRoleLabel('professional')).toBe('Profissional')
    expect(getRoleLabel('client')).toBe('Cliente')
  })

  it('formata slugs customizados como título', () => {
    expect(getRoleLabel('coordenador')).toBe('Coordenador')
    expect(getRoleLabel('auxiliar_tecnico')).toBe('Auxiliar Tecnico')
  })

  it('trata ausência de papel', () => {
    expect(getRoleLabel(null)).toBe('—')
    expect(getRoleLabel(undefined)).toBe('—')
  })
})

describe('listAssignableRoles', () => {
  it('sempre oferece os papéis de equipe padrão', () => {
    expect(listAssignableRoles(undefined)).toEqual(['professional', 'admin'])
    expect(listAssignableRoles({})).toEqual(['professional', 'admin'])
  })

  it('inclui papéis customizados da matriz, ordenados', () => {
    const roles = {
      admin: {},
      professional: {},
      client: {},
      secretaria: {},
      coordenador: {},
    }
    expect(listAssignableRoles(roles)).toEqual([
      'professional',
      'admin',
      'coordenador',
      'secretaria',
    ])
  })

  it('nunca oferece client nem super_admin', () => {
    const roles = { client: {}, super_admin: {}, coordenador: {} }
    expect(listAssignableRoles(roles)).toEqual(['professional', 'admin', 'coordenador'])
  })
})
