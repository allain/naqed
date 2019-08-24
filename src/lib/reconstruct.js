const objectFromEntries = entries =>
  entries.reduce(
    (result, [prop, val]) => Object.assign(result, { [prop]: val }),
    {}
  )

const reconstruct = (obj, fn) =>
  objectFromEntries(
    Object.entries(obj)
      .map(fn)
      .filter(x => x)
  )

reconstruct.async = async (obj, fn) =>
  objectFromEntries(
    (await Promise.all(Object.entries(obj).map(fn))).filter(x => x)
  )

module.exports = reconstruct
