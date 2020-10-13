import * as scalars from '../src/scalars'

it('supports ANY', () => {
  expect(scalars.ANY.name).toEqual('ANY')
  expect(scalars.ANY.check(2.5)).toEqual(true)
  expect(scalars.ANY.check(2)).toEqual(true)
  expect(scalars.ANY.check('bool')).toEqual(true)
})

it('supports BOOL', () => {
  expect(scalars.BOOL.name).toEqual('BOOL')
  expect(scalars.BOOL.check(2.5)).toEqual(false)
  expect(scalars.BOOL.check(2)).toEqual(false)
  expect(scalars.BOOL.check('bool')).toEqual(false)
  expect(scalars.BOOL.check(true)).toEqual(true)
  expect(scalars.BOOL.check(false)).toEqual(true)
})

it('supports FLOAT', () => {
  expect(scalars.FLOAT.name).toEqual('FLOAT')
  expect(scalars.FLOAT.check(2.5)).toEqual(true)
  expect(scalars.FLOAT.check(2)).toEqual(true)
  expect(scalars.FLOAT.check('bool')).toEqual(false)
})

it('supports ID', () => {
  expect(scalars.ID.name).toEqual('ID')
  expect(scalars.ID.check(true)).toEqual(false)
  expect(scalars.ID.check('TESTING')).toEqual(true)
})

it('supports INT', () => {
  expect(scalars.INT.name).toEqual('INT')
  expect(scalars.INT.check(2.5)).toEqual(false)
  expect(scalars.INT.check(2)).toEqual(true)
})

it('supports STRING', () => {
  expect(scalars.STRING.name).toEqual('STRING')
  expect(scalars.STRING.check('test')).toEqual(true)
  expect(scalars.STRING.check(10)).toEqual(false)
})
