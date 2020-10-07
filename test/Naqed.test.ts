import { Naqed } from '../src/Naqed'
import { ID } from '../src/scalars'
const { ANY, STRING } = Naqed.scalars

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
  expect(fieldNames).toContain('request')
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
  const n = new Naqed({
    a: [
      { b: 1, c: 2 },
      { b: 2, c: 3 }
    ]
  })
  const result = await n.request({ a: { b: true } })
  expect(result).toEqual({ a: [{ b: 1 }, { b: 2 }] })
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
