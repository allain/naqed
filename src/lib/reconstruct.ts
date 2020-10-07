type Entry = [EntryKey, any]
type EntryKey = string

export function reconstruct (
  obj: Record<string, any>,
  fn: (entry: Entry) => Entry | true | false
) {
  return Object.entries(obj).reduce<Record<EntryKey, any>>((result, entry) => {
    const newEntry = fn(entry)
    if (!newEntry) return result

    if (newEntry === true) {
      result[entry[0]] = entry[1]
    } else {
      result[newEntry[0]] = newEntry[1]
    }
    return result
  }, {})
}

export async function reconstructAsync (
  obj: any,
  fn: (entry: [string, any]) => Promise<[string, any] | false | true>
) {
  return Object.fromEntries(
    // @ts-ignore
    (
      await Promise.all(
        Object.entries(obj).map(async entry => {
          const newEntry = await fn(entry)
          return newEntry === true ? entry : newEntry
        })
      )
    ).filter(x => x)
  )
}

export async function asyncSeries (
  obj: any,
  fn: (entry: [string, any]) => Promise<any>
) {
  return Object.fromEntries(
    await Object.entries(obj).reduce<Promise<Entry[]>>(
      (entries, entry) =>
        entries.then(async entries => {
          const mapped = await fn(entry)
          return mapped ? [...entries, mapped] : entries
        }),
      Promise.resolve([])
    )
  )
}
