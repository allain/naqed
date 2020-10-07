/**
 * Returns a function that will manipulate objects by filtering and then optionally renaming keys.
 */
export default function pluckKeys (
  keyPredicate: (x: any) => true | false | string | null
) {
  return (obj: any) =>
    Object.entries(obj).reduce<Record<string, any>>((result, [key, val]) => {
      const newKey = keyPredicate(key)
      if (newKey === true) {
        result[key] = val
      } else if (typeof newKey === 'string') {
        result[newKey] = val
      }
      return result
    }, {})
}
