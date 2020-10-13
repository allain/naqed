import { Naqed } from '../src/Naqed'
const { BOOL, ID, INT, ANY, STRING } = Naqed.scalars
const sleep = (ms: number, val: any) =>
  new Promise(r => setTimeout(() => r(val), ms))

it('can be created', () => {
  const n = new Naqed({})
  expect(n).toBeDefined()
  expect(n.request).toBeInstanceOf(Function)
})

it('can be queried with object', async () => {
  const n = new Naqed({ a: 10, b: () => 20, c: true })
  const result = await n.request({ a: true, b: true })
  expect(result.a).toEqual(10)
  expect(result.b).toEqual(20)
  expect(result.c).toBeUndefined()
})

it('throws when given an invalid value for a query', async () => {
  const n = new Naqed({ a: 10, b: () => 20, c: true })
  await expect(n.request({ a: false })).rejects.toThrow()
  await expect(n.request({ a: [] })).rejects.toThrow()
})

it('works when resolving to an array of objects', async () => {
  const n = new Naqed({
    a: [
      { b: 1, c: 2 },
      { b: 2, c: 3 }
    ]
  })
  const result = await n.request({ a: { b: true } })
  expect(result).toEqual({ a: [{ b: 1 }, { b: 2 }] })
})

it('supports defining custom types', async () => {
  const n = new Naqed({
    $A: { name: '$STRING' },
    a: {
      '$A!' () {
        return { name: 'Blah Blah' }
      }
    }
  })

  await expect(n.request({ a: { name: true } })).resolves.toEqual({
    a: { name: 'Blah Blah' }
  })
})

it('supports scalar aliases', async () => {
  const n = new Naqed({
    $EMAIL: STRING,
    email: {
      $EMAIL () {
        return 'a@b.com'
      }
    }
  })

  await expect(n.request({ email: true })).resolves.toEqual({
    email: 'a@b.com'
  })
})

it('supports circular resolvers', async () => {
  const A: any = {}
  const B: any = {
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

it('supports dynamic circular resolvers', async () => {
  const A: any = {
    test
  }
  const B: any = {
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
it('supports untyped dynamic resolution to object', async () => {
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

it('supports untyped dynamic resolver', async () => {
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
    a: [
      { n: 1, plus: 2 },
      { n: 2, plus: 3 }
    ]
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
    add ({ a, b }: any) {
      return a + b
    }
  })
  expect(await n.request({ add: { $a: 1, $b: 2 } })).toEqual({ add: 3 })
})

it('supports full typing of args', async () => {
  const n = new Naqed({
    add: {
      $INT ({ a, b }: any) {
        return a + b
      },
      $a: INT,
      $b: INT
    }
  })
  expect(await n.request({ add: { $a: 1, $b: 2 } })).toEqual({ add: 3 })
})

it('can execute on results of resolver', async () => {
  const n = new Naqed({
    add ({ a, b }: any) {
      return { sum: a + b }
    }
  })
  expect(await n.request({ add: { $a: 1, $b: 2 } })).toEqual({
    add: { sum: 3 }
  })
})

it('supports passing in context while querying', async () => {
  const n = new Naqed({
    test ({}, ctx: any) {
      return ctx
    }
  })

  expect(await n.request({ test: true }, { context: { a: 100 } })).toEqual({
    test: { a: 100 }
  })
})

it('complains on invalid variables', async () => {
  const n = new Naqed({
    echo (x: any) {
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
    echo ({ x }: any) {
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

it('throws when referencing missing varaible', async () => {
  const n = new Naqed({
    echo ({ x }: any) {
      return x
    }
  })

  await expect(
    n.request(
      {
        _vars: {
          id: STRING
        },
        echo: {
          $x: '_missing'
        }
      },
      {
        vars: {
          id: 'HELLO'
        }
      }
    )
  ).rejects.toThrow('reference to unknown var: missing')
})

it('supports binding objects to vars', async () => {
  const n = new Naqed({
    echo ({ x }: any) {
      return x
    }
  })

  expect(
    await n.request(
      {
        _vars: {
          x: ANY
        },
        echo: {
          $x: '_x'
        }
      },
      {
        vars: {
          x: { test: true }
        }
      }
    )
  ).toEqual({ echo: { test: true } })
})

it('supports deep binding objects to vars', async () => {
  const n = new Naqed({
    echo ({ x }: any) {
      return x
    }
  })

  expect(
    await n.request(
      {
        _vars: {
          x: ANY
        },
        echo: {
          $x: { xDeep: '_x' }
        }
      },
      {
        vars: {
          x: { test: true }
        }
      }
    )
  ).toEqual({ echo: { xDeep: { test: true } } })
})

it('supports objects as values without bindings in vars', async () => {
  const n = new Naqed({
    echo ({ x }: any) {
      return x
    }
  })

  expect(
    await n.request(
      {
        _vars: {
          x: ANY
        },
        echo: {
          $x: { test: true }
        }
      },
      {
        vars: {
          x: true
        }
      }
    )
  ).toEqual({ echo: { test: true } })
})

it('supports relations on returned objects', async () => {
  const n = new Naqed({
    $TEST: {
      id: ID,
      name: STRING,
      parent: {
        $TEST () {
          return { id: 'parent1', name: 'parent' }
        }
      }
    },
    test: {
      $TEST () {
        return {
          id: 'child1',
          name: 'child'
        }
      }
    }
  })

  const result = await n.request({
    test: {
      id: true,
      name: true,
      parent: {
        id: true,
        name: true,
        parent: {
          id: true,
          name: true
        }
      }
    }
  })

  expect(result).toEqual({
    test: {
      id: 'child1',
      name: 'child',
      parent: {
        id: 'parent1',
        name: 'parent',
        parent: {
          id: 'parent1',
          name: 'parent'
        }
      }
    }
  })
})

it('cannot request for query and mutation at the same time', async () => {
  const n = new Naqed({})
  await expect(n.request({ a: true, '~b': {} })).rejects.toThrow()
})

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

  expect(result.First).toBeLessThan(result.Second as number)
  expect(result.Second).toBeLessThan(result.Third as number)
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
      async $BOOL (_: any, ctx: any) {
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
  expect(
    () =>
      new Naqed({
        '~Test': {}
      })
  ).toThrow('mutation.invalid')
})

it('rejects when mutation spec has args but no resolver function', () => {
  expect(
    () =>
      new Naqed({
        '~Test': {
          $a: BOOL
        }
      })
  ).toThrow('mutation.invalid')
})

it('returns error when request does not contain query or mutation', async () => {
  const n = new Naqed({
    Test: {
      a: BOOL
    }
  })

  await expect(n.request({})).rejects.toThrow(
    new TypeError('request must either be a query or mutation')
  )
})

it('complains when mutation config is not a function or dynamic object', async () => {
  expect(
    () =>
      new Naqed({
        '~Test': '$WTH'
      })
  ).toThrow('mutation.invalid')
})

it('catches type mismatches on results from dynamic resolvers', async () => {
  const n = new Naqed({
    test: {
      $INT () {
        return 'FAIL'
      }
    }
  })
  const result = await n.request({ test: true })
  expect(result).toEqual({ test: new TypeError('invalid INT: FAIL') })
})

it('fails resolver if args do not match', async () => {
  const n = new Naqed({
    add: {
      $INT ({ a, b }: any) {
        return a + b
      },
      $a: '$INT!',
      $b: '$INT!'
    }
  })
  const result = await n.request({ add: { $a: 'FAIL', $b: 2 } })
  expect(result).toEqual({ add: new TypeError('invalid INT: FAIL') })
})

it('fails resolver if array args do not match', async () => {
  const n = new Naqed({
    add: {
      $INT ({ nums }: any) {
        return nums.reduce((t: number, n: number) => t + n, 0)
      },
      $nums: '$INT[]!'
    }
  })
  const result = await n.request({ add: { $nums: 'FAIL' } })
  expect(result).toEqual({ add: new TypeError('invalid ARRAY: FAIL') })

  await expect(n.request({ add: { $nums: ['FAIL'] } })).resolves.toEqual({
    add: new TypeError('invalid INT: FAIL')
  })
})

it('exposes type shape', async () => {
  const $B = {
    id: '$ID!',
    a: '$A',
    method () {
      return 10
    }
  }
  const n = new Naqed({
    $A: {
      id: '$ID!',
      name: STRING
    },
    $B,
    // Test is a typed resolver that accepts X with ANY type and return an object with the $A type
    test: {
      $A ({ x }: any) {
        return {
          id: 'a',
          name: 'Testing ' + x
        }
      },
      $x: INT
    }
  })

  expect(n.typeShape).toEqual({
    $A: {
      id: '$ID!',
      name: '$STRING'
    },
    $B: {
      id: '$ID!',
      a: '$A',
      method: '$ANY'
    },
    test: {
      $A: true,
      $x: '$INT'
    }
  })
})
