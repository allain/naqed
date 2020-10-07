import { Naqed } from '../src/Naqed'
const { BOOL, INT, STRING } = Naqed.scalars

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
      $ ({ a }: any) {
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
      $ ({ a }: any) {
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

function buildTypeChecker (type: any, typeName = type.name) {
  const spec = {
    [`$${typeName}`]: type,
    test: {
      [`$${typeName}`] ({}, ctx: any) {
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
    // @ts-ignore
    const n = buildTypeChecker(Naqed.scalars[typeName])

    it(`succeeds for ${success.join(', ')} as ${typeName}`, async () => {
      for (const s of success) {
        expect(await n.request({ test: true }, { context: s })).toEqual({
          test: s
        })
      }
    })

    it(`fails for ${fail.join(', ')} as ${typeName}`, async () => {
      for (const f of fail) {
        expect(await n.request({ test: true }, { context: f })).toMatchObject({
          test: { message: `invalid ${typeName}: ${f}` }
        })
      }
    })
  })
}

it('exposes types', () => {
  expect(Object.keys(Naqed.scalars)).toEqual([
    'ANY',
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
      $ ({ x }: any) {
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
      $ ({ x }: any) {
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

  // @ts-ignore
  expect(n._typeChecker.check(true, Naqed.scalars.BOOL)).toEqual(true)
  // @ts-ignore
  expect(n._typeChecker.check('HUH', Naqed.scalars.BOOL)).toMatchObject({
    message: 'invalid BOOL: HUH'
  })
})

it('checks against composite object param type properly', async () => {
  const n = new Naqed({
    $Person: {
      name: STRING
    },
    test: {
      $ ({ p }: any) {
        return p
      },
      $p: '$Person'
    }
  })

  expect(await n.request({ test: { $p: { name: 'Allain' } } })).toEqual({
    test: { name: 'Allain' }
  })
})

it('checks against composite object return type properly', async () => {
  const n = new Naqed({
    $Person: {
      name: STRING
    },
    test: {
      $Person ({}, ctx: any) {
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
      $BOOL ({}, ctx: any) {
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
      '$BOOL[]' ({}, ctx: any) {
        return ctx
      }
    }
  })
  expect(await n.request({ test: true }, { context: [true, false] })).toEqual({
    test: [true, false]
  })

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
      $A ({}, ctx: any) {
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
      $A ({}, ctx: any) {
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

it('returns falsy if undefined', async () => {
  const n = new Naqed({
    test: {
      $BOOL () {
        return null
      }
    }
  })

  expect(await n.request({ test: true })).toEqual({
    test: null
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
  const n = buildTypeChecker({ name: 'TEST', check: (n: any) => n === 5 })
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
  const A: any = { test: 'Hello' }
  A.a = A

  const AType: any = { test: STRING }
  AType.a = AType

  const n = new Naqed({
    $A: AType,
    a: {
      $A () {
        return A
      }
    }
  })

  expect(await n.request({ a: { a: { a: { a: { test: true } } } } })).toEqual({
    a: { a: { a: { a: { test: 'Hello' } } } }
  })
})
