const objectFromEntries = entries =>
  entries.reduce(
    (result, [prop, val]) => Object.assign(result, { [prop]: val }),
    {}
  )

const reconstruct = (obj, fn) =>
  objectFromEntries(
    Object.entries(obj).reduce((newEntries, entry) => {
      newEntry = fn(entry)
      if (!newEntry) return newEntries

      if (newEntry === true) {
        newEntries.push(entry)
      } else {
        newEntries.push(newEntry)
      }
      return newEntries
    }, [])
  )

reconstruct.async = async (obj, fn) =>
  objectFromEntries(
    (await Promise.all(Object.entries(obj).map(fn))).filter(x => x)
  )

reconstruct.asyncSeries = async (obj, fn) => {
  return objectFromEntries(
    await Object.entries(obj).reduce(
      (entries, entry) =>
        entries.then(async entries => {
          const mapped = await fn(entry)
          return mapped ? [...entries, mapped] : entries
        }),
      Promise.resolve([])
    )
  )
}

module.exports = reconstruct
