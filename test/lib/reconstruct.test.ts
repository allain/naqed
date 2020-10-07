import {
  asyncSeries,
  reconstruct,
  reconstructAsync
} from '../../src/lib/reconstruct'

it('should be noop when fn is noop', async () => {
  expect(reconstruct({ a: 10, b: 20 }, x => x)).toEqual({ a: 10, b: 20 })
  expect(await reconstructAsync({ a: 10, b: 20 }, async x => x)).toEqual({
    a: 10,
    b: 20
  })
  expect(await asyncSeries({ a: 10, b: 20 }, async x => x)).toEqual({
    a: 10,
    b: 20
  })
})

it('supports returning true to leave reconstructed entry untouched', async () => {
  expect(reconstruct({ a: 10, b: 20 }, _ => true)).toEqual({ a: 10, b: 20 })
  expect(await reconstructAsync({ a: 10, b: 20 }, async _ => true)).toEqual({
    a: 10,
    b: 20
  })
})

it('filters out entries when returns falsy', async () => {
  expect(reconstruct({ a: 10, b: 20 }, () => false)).toEqual({})
  expect(await reconstructAsync({ a: 10, b: 20 }, async () => false)).toEqual(
    {}
  )
  expect(await asyncSeries({ a: 10, b: 20 }, async () => false)).toEqual({})
})
