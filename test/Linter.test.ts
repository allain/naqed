import { Linter } from '../src/Linter'
import { NaqedError } from '../src/NaqedError'

it('can be created', () => {
  const l = new Linter({})
  expect(l).toBeTruthy()
})

it('does not throw if type found', () => {
  const l = new Linter({ A: {} })
  expect(() => l.lint({ $A () {} })).not.toThrow()
})

it('does throw if type missing', () => {
  const l = new Linter({})
  expect(() => l.lint({ $MISSING () {} })).toThrow(
    new NaqedError('type.unknown', { typeName: 'MISSING' })
  )
})

it('throws is mutation result type is missing', () => {
  const l = new Linter({})
  expect(() => l.lint({ '~test': { $MISSING () {} } })).toThrow(
    new NaqedError('type.unknown', { typeName: 'MISSING' })
  )
})

it('rejects when mutation is not given an object with dynamic method', () => {
  const l = new Linter({})
  expect(() => l.lint({ '~test': { test () {} } })).toThrow(
    new NaqedError('mutation.invalid', { name: 'test' })
  )
})

it('lints deeply nested things', () => {
  const l = new Linter({})
  expect(() => l.lint({ a: { b: { c: { $MISSING () {} } } } })).toThrow(
    new NaqedError('type.unknown', { typeName: 'MISSING' })
  )
})

it('supports linting arrays', () => {
  const l = new Linter({ A: {} })
  expect(() => l.lint([{ a: { $A () {} } }])).not.toThrow()
  expect(() => l.lint([{ a: { $MISSING () {} } }])).toThrow()
})

it('does throw if malformed type spec', () => {
  const l = new Linter({})
  expect(() => l.lint([{ a: { '$$MALFORMED!!' () {} } }])).toThrow(
    new NaqedError('type.malformed')
  )
})

it('supports checking simple type spec', () => {
  const l = new Linter({ A: {} })
  expect(() => l.lint(['$$$$$A!!'])).toThrow(new NaqedError('type.malformed'))
  expect(() => l.lint(['$A!'])).not.toThrow()
})

it('shortcuts on scalars', () => {
  const $A = {
    check () {
      return true
    }
  }
  const l = new Linter({
    A: $A
  })
  expect(() =>
    l.lint({
      a: {
        '$A!' () {
          return 'A'
        }
      }
    })
  ).not.toThrow()
  expect(() =>
    l.lint({
      a: $A
    })
  ).not.toThrow()
})

it('accepts simplest type spec "$"', () => {
  const l = new Linter({})
  expect(() =>
    l.lint({
      a: {
        $ () {
          return 'A'
        }
      }
    })
  ).not.toThrow()
})

it('shortcuts when it sees an object multiple time', () => {
  const $A = {
    check () {
      return true
    }
  }
  const l = new Linter({})
  expect(() =>
    l.lint({
      a: $A,
      b: $A
    })
  ).not.toThrow()
})
