import { TypeEnforcer } from '../src/TypeEnforcer'
// const { BOOL, INT, STRING } = Naqed.scalars
import { scalars } from '../src/Naqed'

it('enforces built in scalars', async () => {
  const n = new TypeEnforcer(scalars)
  expect(
    n.check(
      { test: 'FAIL' },
      {
        test: scalars.BOOL
      }
    )
  ).toEqual({ test: new TypeError('invalid BOOL: FAIL') })
})

it('supports type as string in spec', () => {
  const n = new TypeEnforcer(scalars)
  expect(n.check('FAIL', '$BOOL!')).toEqual(new TypeError('invalid BOOL: FAIL'))
})

it('supports type checking against arrays', () => {
  const n = new TypeEnforcer(scalars)
  expect(n.check(['FAIL'], ['$BOOL!'])).toEqual([
    new TypeError('invalid BOOL: FAIL')
  ])
  expect(n.check(['FAIL'], '$BOOL[]!')).toEqual([
    new TypeError('invalid BOOL: FAIL')
  ])
  expect(n.check('FAIL', '$BOOL[]!')).toEqual(
    new TypeError('invalid ARRAY: FAIL')
  )
})

// TODO: Decide
it('allows spec through if simple value', () => {
  const n = new TypeEnforcer(scalars)
  expect(n.check('OK', 123)).toEqual('OK')
})

it('handler ! required properly on simple values', () => {
  const n = new TypeEnforcer(scalars)
  expect(n.check(null, '$BOOL')).not.toEqual(new TypeError('required'))
  expect(n.check(null, '$BOOL!')).toEqual(new TypeError('required'))
})

it('handles types properly on dynamic resolvers', () => {
  const n = new TypeEnforcer(scalars)
  expect(n.check(null, { $BOOL () {} })).not.toEqual(new TypeError('required'))
  expect(n.check(null, { '$BOOL!' () {} })).toEqual(new TypeError('required'))
})

it('handles required on array type properly on dynamic resolvers', () => {
  const n = new TypeEnforcer(scalars)
  expect(n.check(null, { '$BOOL[]' () {} })).not.toEqual(
    new TypeError('required')
  )
  expect(n.check(null, { '$BOOL[]!' () {} })).toEqual(new TypeError('required'))
})

it('handles array type properly on dynamic resolvers', () => {
  const n = new TypeEnforcer(scalars)
  expect(n.check([true, false, true], { '$BOOL[]' () {} })).toEqual([
    true,
    false,
    true
  ])
  expect(n.check(['FAIL', true, false], { '$BOOL[]!' () {} })).toEqual([
    new TypeError('invalid BOOL: FAIL'),
    true,
    false
  ])
  expect(n.check(true, { '$BOOL[]!' () {} })).toEqual(
    new TypeError('invalid Array: true')
  )
})

it('passes when passed empty array', () => {
  const n = new TypeEnforcer(scalars)
  expect(n.check([], { '$BOOL[]' () {} })).toEqual([])
})

it('supports deep type checking', () => {
  const n = new TypeEnforcer({ ...scalars, A: { b: { c: scalars.BOOL } } })
  expect(n.check({ a: { b: { c: false } } }, { a: { $A () {} } })).toEqual({
    a: { b: { c: false } }
  })
})

it('supports type checking mutation responses', () => {
  const n = new TypeEnforcer(scalars)
  expect(n.check({ add: 2 }, { '~add': { '$INT!' () {} } })).toEqual({ add: 2 })
})

it('passes through untyped props', () => {
  const n = new TypeEnforcer(scalars)
  expect(n.check({ add: 2 }, {})).toEqual({ add: 2 })
})

it('returns type error when value is one', () => {
  const n = new TypeEnforcer(scalars)
  expect(n.check(new TypeError('DOH!'), {})).toEqual(new TypeError('DOH!'))
})
