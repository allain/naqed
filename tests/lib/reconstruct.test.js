const recon = require('../../src/lib/reconstruct')

it('should be noop when fn is noop', async () => {
  expect(recon({ a: 10, b: 20 }, x => x)).toEqual({ a: 10, b: 20 })
  expect(await recon.async({ a: 10, b: 20 }, async x => x)).toEqual({
    a: 10,
    b: 20
  })
  expect(await recon.asyncSeries({ a: 10, b: 20 }, async x => x)).toEqual({
    a: 10,
    b: 20
  })
})

it('filters out entries when returns falsy', async () => {
  expect(recon({ a: 10, b: 20 }, () => false)).toEqual({})
  expect(await recon.async({ a: 10, b: 20 }, async () => false)).toEqual({})
  expect(await recon.asyncSeries({ a: 10, b: 20 }, async () => false)).toEqual(
    {}
  )
})
