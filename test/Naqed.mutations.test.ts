import { Naqed } from '../src/Naqed'

const { BOOL } = Naqed.scalars

const sleep = (ms: number, val: any) =>
  new Promise(r => setTimeout(() => r(val), ms))

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
  ).toThrow('mutation.invalid')
})
