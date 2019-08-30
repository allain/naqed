const Naqed = require('../src/Naqed')
const { BOOL, INT, STRING } = Naqed.types

const sleep = (ms, val) =>
  new Promise(resolve => setTimeout(() => resolve(val), ms))

it('can be created', () => {
  const n = new Naqed({ a: 10, b: () => 20, c: true })
  expect(n).toBeDefined()
  expect(n.request).toBeInstanceOf(Function)
})

it('has expected API', () => {
  const n = new Naqed({})
  const fieldNames = Object.getOwnPropertyNames(Object.getPrototypeOf(n))
    .filter(f => !f.startsWith('_'))
    .sort()
  expect(fieldNames).toEqual(['constructor', 'request'])

  expect(n.request).toBeInstanceOf(Function)
  expect(n.request({ test: 1 }).catch(() => true)).toBeInstanceOf(Promise)
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
  const B = {
    test () {
      return 'Hello'
    }
  }
  A.b = B
  B.a = A

  const n = new Naqed({
    a: A
  })

  expect(await n.request({ a: { b: { a: { b: { test: true } } } } })).toEqual({
    a: { b: { a: { b: { test: 'Hello' } } } }
  })
})

it('supports typeless dynamic resolution to object', async () => {
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

it('supports typeless dynamic resolver', async () => {
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

  expect(await n.request({ test: true }, { context: { a: 100 } })).toEqual({
    test: { a: 100 }
  })
})

describe('type checking', () => {
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

  it('throws type error when requested type is not known', async () => {
    expect(
      () =>
        new Naqed({
          test: {
            $MISSING () {
              return 'FAIL'
            }
          }
        })
    ).toThrow(new TypeError('unknown type: MISSING'))
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

  it('type checking resolver arguments is optional', async () => {
    const n = new Naqed({
      test: {
        $ ({ a }) {
          return a + 1
        }
      }
    })
    expect(await n.request({ test: { $a: 1 } })).toEqual({
      test: 2
    })

    expect(await n.request({ test: { $a: 'TEST' } })).toEqual({
      test: 'TEST1'
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
      fail: [true, 10, '', {}]
    },
    STRING: {
      success: ['Hello', '', 'true'],
      fail: [true, 10, Date]
    },
    BOOL: {
      success: [true, false],
      fail: ['true', {}]
    },
    INT: {
      success: [-10, 10, 0],
      fail: [Number.POSITIVE_INFINITY, 1.5, {}, true, Number.NaN]
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
          expect(await n.request({ test: true }, { context: s })).toEqual({
            test: s
          })
        }
      })

      it(`fails for ${fail.join(', ')} as ${typeName}`, async () => {
        for (const f of fail) {
          expect(await n.request({ test: true }, { context: f })).toMatchObject(
            {
              test: { message: `invalid ${typeName}: ${f}` }
            }
          )
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

  it('supports giving types as TYPENAME strings', async () => {
    const n = new Naqed({
      a: {
        $ ({ x }) {
          return x
        },
        $x: '$INT'
      }
    })

    expect(await n.request({ a: { $x: 10 } })).toEqual({
      a: 10
    })

    expect(await n.request({ a: { $x: 'FAIL' } })).toEqual({
      a: new TypeError('invalid INT: FAIL')
    })
  })

  it('supports giving types as TYPENAME[] strings', async () => {
    const n = new Naqed({
      a: {
        $ ({ x }) {
          return x
        },
        $x: '$INT[]'
      }
    })

    expect(await n.request({ a: { $x: [10] } })).toEqual({
      a: [10]
    })

    expect(await n.request({ a: { $x: ['FAIL'] } })).toEqual({
      a: new TypeError('invalid INT[] arg x: [FAIL]')
    })
  })

  it('checks scalars properly', async () => {
    const n = new Naqed({})

    expect(n._check(true, Naqed.types.BOOL)).toEqual(true)
    expect(n._check('HUH', Naqed.types.BOOL)).toMatchObject({
      message: 'invalid BOOL: HUH'
    })
  })

  it('checks agains composite object param type properly', async () => {
    const n = new Naqed({
      $Person: {
        name: STRING
      },
      test: {
        $ ({ p }) {
          return p
        },
        $p: '$Person'
      }
    })

    expect(await n.request({ test: { $p: { name: 'Allain' } } })).toEqual({
      test: { name: 'Allain' }
    })
  })

  it('checks agains composite object return type properly', async () => {
    const n = new Naqed({
      $Person: {
        name: STRING
      },
      test: {
        $Person ({}, ctx) {
          return ctx
        }
      }
    })

    expect(
      await n.request({ test: true }, { context: { name: 'Allain' } })
    ).toEqual({
      test: { name: 'Allain' }
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

    expect(await n.request({ test: true }, { context: true })).toEqual({
      test: true
    })

    expect(await n.request({ test: true }, { context: 'FAIL' })).toEqual({
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
    expect(await n.request({ test: true }, { context: [true, false] })).toEqual(
      {
        test: [true, false]
      }
    )

    expect(await n.request({ test: true }, { context: ['FAIL'] })).toEqual({
      test: [new TypeError('invalid BOOL: FAIL')]
    })
  })

  it('allows typechecking using Array for field', async () => {
    const n = new Naqed({
      $A: {
        tags: [STRING]
      },
      test: {
        $A ({}, ctx) {
          return ctx
        }
      }
    })
    expect(
      await n.request({ test: true }, { context: { tags: ['a', 'b'] } })
    ).toEqual({
      test: { tags: ['a', 'b'] }
    })

    expect(
      await n.request({ test: true }, { context: { tags: 'FAIL' } })
    ).toEqual({
      test: { tags: new TypeError('invalid Array: FAIL') }
    })
  })

  it('allows typechecking using "Type[]" for field', async () => {
    const n = new Naqed({
      $A: {
        tags: '$STRING[]'
      },
      test: {
        $A ({}, ctx) {
          return ctx
        }
      }
    })
    expect(
      await n.request({ test: true }, { context: { tags: ['a', 'b'] } })
    ).toEqual({
      test: { tags: ['a', 'b'] }
    })

    expect(
      await n.request({ test: true }, { context: { tags: 'FAIL' } })
    ).toEqual({
      test: { tags: new TypeError('invalid Array: FAIL') }
    })
  })

  it('supports enforcing non-null types', async () => {
    const n = new Naqed({
      test: {
        '$BOOL!' () {
          return null
        }
      }
    })

    expect(await n.request({ test: true })).toEqual({
      test: new TypeError('missing BOOL')
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
    expect(await n.request({ test: true }, { context: 5 })).toEqual({ test: 5 })
    expect(await n.request({ test: true }, { context: 10 })).toMatchObject({
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
      await n.request(
        { test: { a: true, b: true } },
        { context: { a: 1, b: true } }
      )
    ).toEqual({
      test: { a: 1, b: true }
    })
    expect(
      await n.request(
        { test: { a: true, b: true } },
        { context: { a: 20, b: 'BAD' } }
      )
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
        $STRING: () => 'YO'
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

describe('mutations', () => {
  it('rejects when mutations and queries are mixed', async () => {
    const n = new Naqed({
      users () {
        fail('should not get here')
      },
      '~CreateUser' () {
        fail('should not get here')
      }
    })

    await expect(
      n.request({
        users: true,
        '~CreateUser': {}
      })
    ).rejects.toThrow('cannot mix queries and mutations')
  })

  it('runs mutations in series', async () => {
    const n = new Naqed({
      async '~First' () {
        return sleep(10, Date.now())
      },
      async '~Second' () {
        return sleep(10, Date.now())
      },
      async '~Third' () {
        return sleep(10, Date.now())
      }
    })

    const result = await n.request({
      '~First': {},
      '~Second': {},
      '~Third': {}
    })
    expect(typeof result.First).toEqual('number')
    expect(typeof result.Second).toEqual('number')
    expect(typeof result.Third).toEqual('number')

    expect(result.First).toBeLessThan(result.Second)
    expect(result.Second).toBeLessThan(result.Third)
  })

  it('complains when mutation requested does not exist', async () => {
    const n = new Naqed({
      async '~Test' () {
        return true
      }
    })

    expect(await n.request({ '~Missing': {} })).toEqual({
      Missing: new TypeError('unknown mutation: Missing')
    })
  })

  it('complains when mutation is not given an args object', async () => {
    const n = new Naqed({
      async '~Test' () {
        return true
      }
    })

    expect(await n.request({ '~Test': true })).toEqual({
      Test: new TypeError('invalid mutation args: true')
    })
  })

  it('supports typed mutations', async () => {
    const n = new Naqed({
      '~Test': {
        async $BOOL (_, ctx) {
          return ctx
        }
      }
    })

    expect(await n.request({ '~Test': {} }, { context: true })).toEqual({
      Test: true
    })

    expect(await n.request({ '~Test': {} }, { context: 'FAIL' })).toEqual({
      Test: new TypeError('invalid BOOL: FAIL')
    })
  })

  it('rejects when mutation spec does not have any Dynamic keys', async () => {
    const n = new Naqed({
      '~Test': {}
    })

    const result = await n.request({
      '~Test': {}
    })

    expect(result.Test).toEqual(
      new TypeError('no resolver found for mutation: Test')
    )
  })

  it('rejects when mutation spec has args but no resolver function', async () => {
    const n = new Naqed({
      '~Test': {
        $a: BOOL
      }
    })

    const result = await n.request({
      '~Test': {}
    })

    expect(result.Test).toEqual(
      new TypeError('no resolver found for mutation: Test')
    )
  })

  it('returns error when request does not contain query or mutation', async () => {
    const n = new Naqed({
      '~Test': {
        $a: BOOL
      }
    })

    expect(await n.request({})).toEqual(
      new TypeError('request must either be a query or mutation')
    )
  })

  it('complains when mutation config is not a function or dynamic object', async () => {
    expect(
      () =>
        new Naqed({
          '~Test': '$WTH'
        })
    ).toThrow(new TypeError('unknown type: WTH'))
  })

  it('complains on invalid variables', async () => {
    const n = new Naqed({
      echo (x) {
        return x
      }
    })

    expect(
      await n.request(
        {
          _vars: {
            id: STRING
          },
          echo: {
            $x: '_id'
          }
        },
        {
          vars: {
            id: 10
          }
        }
      )
    ).toEqual({ _vars: { id: new TypeError('invalid STRING: 10') } })
  })

  it('supports using variables', async () => {
    const n = new Naqed({
      echo ({ x }) {
        return x
      }
    })

    expect(
      await n.request(
        {
          _vars: {
            id: STRING
          },
          echo: {
            $x: '_id'
          }
        },
        {
          vars: {
            id: 'HELLO'
          }
        }
      )
    ).toEqual({ echo: 'HELLO' })
  })
})
