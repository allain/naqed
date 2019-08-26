const Naqed = require('../src/Naqed')
const { BOOL, INT, STRING } = Naqed.types

it('can be created', () => {
  const n = new Naqed({ a: 10, b: () => 20, c: true })
  expect(n).toBeDefined()
  expect(n.request).toBeInstanceOf(Function)
})

it('throws when given an invalid value for a query', async () => {
  const n = new Naqed({ a: 10, b: () => 20, c: true })
  await expect(n.request({ a: false })).rejects.toThrow()
  await expect(n.request({ a: [] })).rejects.toThrow()
})

it('can be queried with object', async () => {
  const n = new Naqed({ a: 10, b: () => 20, c: true })
  const result = await n.request({ a: true, b: true })
  expect(result.a).toEqual(10)
  expect(result.b).toEqual(20)
  expect(result.c).toBeUndefined()
})

it('works when resolving to an array of objects', async () => {
  const n = new Naqed({ a: [{ b: 1, c: 2 }, { b: 2, c: 3 }] })
  const result = await n.request({ a: { b: true } })
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

  expect(await n.request({ a: { b: { a: { b: { test: true } } } } })).toEqual({
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

  expect(await n.request({ a: { n: true, plus: true } })).toEqual({
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

  expect(await n.request({ a: { n: true, plus: true } })).toEqual({
    a: [{ n: 1, plus: 2 }, { n: 2, plus: 3 }]
  })
})

it('querying for missing fields return null', async () => {
  const n = new Naqed({ a: 1, b: 2 })
  expect(await n.request({ a: true, c: true })).toEqual({ a: 1, c: null })
})

it('can query for a whole object', async () => {
  const n = new Naqed({ a: { b: { c: 20 } } })
  const result = await n.request({ a: true })
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

  await expect(n.request({ a: { b: true } })).resolves.toEqual({ a: { b: 10 } })
})

it('can pass args', async () => {
  const n = new Naqed({
    add ({ a, b }) {
      return a + b
    }
  })
  expect(await n.request({ add: { $a: 1, $b: 2 } })).toEqual({ add: 3 })
})

it('can execute on results of resolver', async () => {
  const n = new Naqed({
    add ({ a, b }) {
      return { sum: a + b }
    }
  })
  expect(await n.request({ add: { $a: 1, $b: 2 } })).toEqual({
    add: { sum: 3 }
  })
})

it('supports passing in context while querying', async () => {
  const n = new Naqed({
    test ({}, ctx) {
      return ctx
    }
  })

  expect(await n.request({ test: true }, { a: 100 })).toEqual({
    test: { a: 100 }
  })
})

describe('type checking', () => {
  it('exposes typePrototypes', () => {
    const TestType = {
      name: STRING,
      subtests: {
        $Test () {
          return [{ name: 'Sub1' }, { name: 'Sub1' }]
        }
      }
    }
    const n = new Naqed({
      $Test: TestType
    })

    const typeProto = n.typePrototypes.Test
    expect(typeProto).toBeDefined()
    expect(Object.keys(typeProto)).toEqual(['subtests'])
    expect(typeProto.subtests).toEqual(TestType.subtests)
  })

  it('enforces built in scalars', async () => {
    const n = new Naqed({
      test: {
        $BOOL () {
          return 'FAIL'
        }
      }
    })
    const result = await n.request({ test: true })
    expect(result).toEqual({
      test: new TypeError('invalid BOOL: FAIL')
    })
  })

  it('enforces scalar aliases as such', async () => {
    const n = new Naqed({
      $SUCCESS: BOOL,
      test: {
        $SUCCESS () {
          return 'FAIL'
        }
      }
    })
    const result = await n.request({ test: true })
    expect(result).toEqual({
      test: new TypeError('invalid SUCCESS: FAIL')
    })
  })

  it('returns type error when requested type is not known', async () => {
    const n = new Naqed({
      test: {
        $MISSING () {
          return 'FAIL'
        }
      }
    })
    const result = await n.request({ test: true })
    expect(result).toEqual({
      test: new TypeError('unknown type: MISSING')
    })
  })

  it('supports type checking resolver arguments', async () => {
    const n = new Naqed({
      test: {
        $ ({ a }) {
          return a + 1
        },
        $a: INT
      }
    })
    expect(await n.request({ test: { $a: 1 } })).toEqual({
      test: 2
    })

    expect(await n.request({ test: { $a: 'TEST' } })).toEqual({
      test: new TypeError('invalid INT: TEST')
    })
  })

  function buildTypeChecker (type, typeName = type.name) {
    const spec = {
      [`$${typeName}`]: type,
      test: {
        [`$${typeName}`] ({}, ctx) {
          return ctx
        }
      }
    }
    return new Naqed(spec)
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
          expect(await n.request({ test: true }, s)).toEqual({
            test: s
          })
        }
      })

      it(`fails for ${fail.join(', ')} as ${typeName}`, async () => {
        for (const f of fail) {
          expect(await n.request({ test: true }, f)).toMatchObject({
            test: { message: `invalid ${typeName}: ${f}` }
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

  it('checks scalars properly', async () => {
    const n = new Naqed({})

    expect(n._check(true, Naqed.types.BOOL)).toEqual(true)
    expect(n._check('HUH', Naqed.types.BOOL)).toMatchObject({
      message: 'invalid BOOL: HUH'
    })
  })

  it('checks agains composite object properly', async () => {
    const n = new Naqed({
      $Person: {
        name: STRING
      }
    })

    expect(n._check({ name: 'Allain' }, n.types.Person)).toEqual({
      name: 'Allain'
    })
    expect(n._check({ name: false }, n.types.Person)).toEqual({
      name: new TypeError('invalid STRING: false')
    })
  })

  it('allows checking against dynamic scalar', async () => {
    const n = new Naqed({
      test: {
        $BOOL ({}, ctx) {
          return ctx
        }
      }
    })

    expect(await n.request({ test: true }, true)).toEqual({
      test: true
    })

    expect(await n.request({ test: true }, 'FAIL')).toEqual({
      test: new TypeError('invalid BOOL: FAIL')
    })
  })

  it('allows typechecking using Array', async () => {
    const n = new Naqed({
      test: {
        '$BOOL[]' ({}, ctx) {
          return ctx
        }
      }
    })
    expect(await n.request({ test: true }, [true, false])).toEqual({
      test: [true, false]
    })

    expect(await n.request({ test: true }, ['FAIL'])).toEqual({
      test: [new TypeError('invalid BOOL: FAIL')]
    })
  })

  it('return TypeError when Array is type but non-array given in resolver', async () => {
    const n = new Naqed({
      test: {
        '$BOOL[]' () {
          return true
        }
      }
    })

    expect(await n.request({ test: true })).toEqual({
      test: new TypeError('invalid Array: true')
    })
  })

  it('supports custom scalar types', async () => {
    const n = buildTypeChecker({ name: 'TEST', check: n => n === 5 })
    expect(await n.request({ test: true }, 5)).toEqual({ test: 5 })
    expect(await n.request({ test: true }, 10)).toMatchObject({
      test: {
        message: /^invalid TEST: 10/
      }
    })
  })

  it('supports custom object types', async () => {
    const n = buildTypeChecker(
      {
        a: INT,
        b: BOOL
      },
      'CUSTOM'
    )
    expect(
      await n.request({ test: { a: true, b: true } }, { a: 1, b: true })
    ).toEqual({
      test: { a: 1, b: true }
    })
    expect(
      await n.request({ test: { a: true, b: true } }, { a: 20, b: 'BAD' })
    ).toMatchObject({
      test: {
        b: {
          message: /^invalid BOOL: BAD/
        }
      }
    })
  })

  it('retains out props when type says nothing about them', async () => {
    const n = new Naqed({
      a: {
        $STRING: 'YO'
      }
    })
    expect(await n.request({ a: true, b: true })).toEqual({ a: 'YO', b: null })
  })

  it('supports circular types', async () => {
    const A = { test: 'Hello' }
    A.a = A

    const AType = { test: STRING }
    AType.a = AType

    const n = new Naqed({
      $A: AType,
      a: {
        $A () {
          return A
        }
      }
    })

    expect(await n.request({ a: { a: { a: { a: { test: true } } } } })).toEqual(
      {
        a: { a: { a: { a: { test: 'Hello' } } } }
      }
    )
  })
})
