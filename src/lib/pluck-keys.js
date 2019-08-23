/**
 * Returns a function that will manipulate objects by filtering and then optionally renaming keys.
 *
 * @param {Function} keyPredicate
 * @returns {object}
 */
module.exports = function pluckKeys (keyPredicate) {
  return obj =>
    Object.entries(obj).reduce((result, [key, val]) => {
      const newKey = keyPredicate(key)
      if (newKey === true) {
        result[key] = val
      } else if (typeof newKey === 'string') {
        result[newKey] = val
      }

      return result
    }, {})
}
