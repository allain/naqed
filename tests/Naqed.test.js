const Naqed = require('../src/Naqed')

it('can be created', () => {
  const n = new Naqed({ a: 10, b: () => 20, c: true })
  expect(n).toBeDefined()
  expect(n.query).toBeInstanceOf(Function)
})

it('throws when given an invalid value for a query', async () => {
  const n = new Naqed({ a: 10, b: () => 20, c: true })
  await expect(n.query({ a: false })).rejects.toThrow()
  await expect(n.query({ a: [] })).rejects.toThrow()
})

it('can be queried with object', async () => {
  const n = new Naqed({ a: 10, b: () => 20, c: true })
  const result = await n.query({ a: true, b: true })
  expect(result.a).toEqual(10)
  expect(result.b).toEqual(20)
  expect(result.c).toBeUndefined()
})

it('works when resolving to an array of objects', async () => {
  const n = new Naqed({ a: [{ b: 1, c: 2 }, { b: 2, c: 3 }] })
  const result = await n.query({ a: { b: true } })
  expect(result).toEqual({ a: [{ b: 1 }, { b: 2 }] })
})

it('supports circular resolvers', async () => {
  const A = {}
  const B = { test: 'Hello' }
  A.b = B
  B.a = A

  const n = new Naqed({
    a: A
  })

  expect(await n.query({ a: { b: { a: { b: { test: true } } } } })).toEqual({
    a: { b: { a: { b: { test: 'Hello' } } } }
  })
})

it('supports simple dynamic resolution to object', async () => {
  const n = new Naqed({
    a: {
      $ () {
        return { n: 1 }
      },
      plus () {
        return this.n + 1
      }
    }
  })

  expect(await n.query({ a: { n: true, plus: true } })).toEqual({
    a: { n: 1, plus: 2 }
  })
})

it('supports simple dynamic resolver', async () => {
  const n = new Naqed({
    a: {
      $ () {
        return [{ n: 1 }, { n: 2 }]
      },
      plus () {
        return this.n + 1
      }
    }
  })

  expect(await n.query({ a: { n: true, plus: true } })).toEqual({
    a: [{ n: 1, plus: 2 }, { n: 2, plus: 3 }]
  })
})

it('throws when dynamic resolver returns something that is not an object', async () => {
  const n = new Naqed({
    a: {
      $ () {
        return false
      }
    }
  })

  await expect(n.query({ a: true })).rejects.toThrow()
})

it('querying for missing fields return null', async () => {
  const n = new Naqed({ a: 1, b: 2 })
  expect(await n.query({ a: true, c: true })).toEqual({ a: 1, c: null })
})

it('can query for a whole object', async () => {
  const n = new Naqed({ a: { b: { c: 20 } } })
  const result = await n.query({ a: true })
  expect(result.a).toEqual({ b: { c: 20 } })
})

it('unrolls async paths', async () => {
  const n = new Naqed({
    async a () {
      return {
        async b () {
          return 10
        }
      }
    }
  })

  await expect(n.query({ a: { b: true } })).resolves.toEqual({ a: { b: 10 } })
})

it('can pass args', async () => {
  const n = new Naqed({
    add ({ a, b }) {
      return a + b
    }
  })
  expect(await n.query({ add: { $a: 1, $b: 2 } })).toEqual({ add: 3 })
})

it('can execute on results of resolver', async () => {
  const n = new Naqed({
    add ({ a, b }) {
      return { sum: a + b }
    }
  })
  expect(await n.query({ add: { $a: 1, $b: 2 } })).toEqual({
    add: { sum: 3 }
  })
})

it('supports passing in context while querying', async () => {
  const n = new Naqed({
    test ({}, ctx) {
      return ctx
    }
  })

  expect(await n.query({ test: true }, { a: 100 })).toEqual({
    test: { a: 100 }
  })
})

describe('typechecking', () => {
  function buildTypeChecker (type) {
    return new Naqed(
      {
        test ({}, ctx) {
          return ctx
        }
      },
      { test: type }
    )
  }

  const checks = {
    ID: {
      success: ['123'],
      fail: [true, 10, '', null, {}]
    },
    STRING: {
      success: ['Hello', '', 'true'],
      fail: [true, 10, Date]
    },
    BOOL: {
      success: [true, false],
      fail: ['true', null, {}]
    },
    INT: {
      success: [-10, 10, 0],
      fail: [Number.POSITIVE_INFINITY, 1.5, null, {}, true, Number.NaN]
    },
    FLOAT: {
      success: [Number.POSITIVE_INFINITY, -10, 10, 0, 5.5, 0.5],
      fail: [Number.NaN, {}, true]
    }
  }

  for (const [typeName, { success, fail }] of Object.entries(checks)) {
    describe(typeName, () => {
      const n = buildTypeChecker(Naqed.types[typeName])

      it(`succeeds for ${success.join(', ')} as ${typeName}`, async () => {
        for (const s of success) {
          expect(await n.query({ test: true }, s)).toEqual({
            test: s
          })
        }
      })

      it(`fails for ${fail.join(', ')} as ${typeName}`, async () => {
        for (const f of fail) {
          expect(await n.query({ test: true }, f)).toMatchObject({
            test: { message: /^invalid/ }
          })
        }
      })
    })
  }

  it('exposes types', () => {
    expect(Object.keys(Naqed.types)).toEqual([
      'BOOL',
      'FLOAT',
      'ID',
      'INT',
      'STRING'
    ])
  })

  it('allows typechecking using Array', async () => {
    const n = buildTypeChecker([Naqed.types.BOOL])
    expect(await n.query({ test: true }, [true, false])).toEqual({
      test: [true, false]
    })

    expect(await n.query({ test: true }, ['FAIL'])).toEqual({
      test: [new TypeError('invalid BOOL: FAIL')]
    })
  })

  it('throws if typeshape is not one of the provided', async () => {
    const n = buildTypeChecker(Boolean)
    await expect(n.query({ test: true }, true)).rejects.toMatchObject({
      message: /^invalid typeshape provided/
    })
  })

  it('supports custom scalar types', async () => {
    const n = buildTypeChecker({ name: 'TEST', check: n => n === 5 })
    expect(await n.query({ test: true }, 5)).toEqual({ test: 5 })
    expect(await n.query({ test: true }, 10)).toMatchObject({
      test: {
        message: /^invalid TEST: 10/
      }
    })
  })

  it('supports custom object types', async () => {
    const n = buildTypeChecker({
      a: Naqed.types.INT,
      b: Naqed.types.BOOL
    })
    expect(
      await n.query({ test: { a: true, b: true } }, { a: 1, b: true })
    ).toEqual({
      test: { a: 1, b: true }
    })
    expect(
      await n.query({ test: { a: true, b: true } }, { a: 20, b: 'BAD' })
    ).toMatchObject({
      test: {
        b: {
          message: /^invalid BOOL: BAD/
        }
      }
    })
  })

  it('supports circular types', async () => {
    const A = { test: 'Hello' }
    A.a = A

    const AType = { test: Naqed.types.STRING }
    AType.a = AType

    const n = new Naqed(
      {
        a: A
      },
      { a: AType }
    )

    expect(await n.query({ a: { a: { a: { a: { test: true } } } } })).toEqual({
      a: { a: { a: { a: { test: 'Hello' } } } }
    })
  })
})
