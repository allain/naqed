function isObject (x) {
  return x && !Array.isArray(x) && typeof x === 'object'
}

function objectFromEntries (entries) {
  return entries.reduce((result, [prop, val]) => {
    result[prop] = val
    return result
  }, {})
}

const pluckKeys = require('./lib/pluck-keys')

const extractArgs = pluckKeys(
  keyName => keyName.startsWith('$') && keyName.substr(1)
)
const extractNonArgs = pluckKeys(keyName => !keyName.startsWith('$'))

class Naqed {
  constructor (spec, typeShape) {
    this.spec = spec
    this.typeShape = typeShape
  }

  async query (q, ctx = {}) {
    const resolved = await this._resolveQuery(this.spec, q, ctx, this.typeShape)
    return this.typeShape
      ? this._applyTypeShape(this.typeShape, resolved)
      : resolved
  }

  async _resolveQuery (spec, query, ctx, typeShape) {
    const resultEntries = await Promise.all(
      Object.entries(query).map(async ([queryProp, queryVal]) => {
        if (queryVal !== true && !isObject(queryVal)) {
          throw new Error('invalid query value: ' + queryVal)
        }

        let resolveVal = spec[queryProp]

        if (typeof resolveVal === 'undefined') {
          return [queryProp, null]
        }

        if (typeof resolveVal === 'function') {
          resolveVal = resolveVal.apply(spec, [extractArgs(queryVal), ctx])
          queryVal = extractNonArgs(queryVal)
        } else if (isObject(resolveVal) && resolveVal.$) {
          // resolver with dynamic shape for results
          const shape = extractNonArgs(resolveVal)
          const resolved = await resolveVal.$(extractArgs(queryVal), ctx)
          if (Array.isArray(resolved)) {
            resolveVal = resolved.map(obj => Object.setPrototypeOf(obj, shape))
          } else if (isObject(resolved)) {
            resolveVal = Object.assign(Object.create(shape), resolved)
          } else {
            throw new Error(
              'dynamic resolver only makes sense with object or arrays of objects'
            )
          }
        }

        if (resolveVal && resolveVal.then) {
          resolveVal = await resolveVal
        }

        if (isObject(queryVal) && Object.keys(queryVal).length > 0) {
          if (Array.isArray(resolveVal)) {
            resolveVal = await Promise.all(
              resolveVal.map(rv => this._resolveQuery(rv, queryVal, ctx))
            )
          } else {
            resolveVal = await this._resolveQuery(resolveVal, queryVal, ctx)
          }
        }

        return [queryProp, resolveVal]
      })
    )

    return objectFromEntries(resultEntries)
  }

  _applyTypeShape (typeShape, value) {
    if (!typeShape) return null

    if (Array.isArray(typeShape)) {
      if (!Array.isArray(value)) return new TypeError('invalid Array')

      return value.map(v => this._applyTypeShape(typeShape[0], v))
    }

    if (typeShape.check) {
      if (typeShape.check(value)) {
        return value
      }

      return new TypeError(`invalid ${typeShape.name}: ${value}`)
    }

    if (typeof typeShape === 'object') {
      const typedEntries = Object.entries(value)
        .map(([prop, val]) => {
          if (!typeShape[prop]) return null

          return [prop, this._applyTypeShape(typeShape[prop], val)]
        })
        .filter(Boolean)

      return objectFromEntries(typedEntries)
    }

    throw new TypeError('invalid typeshape provided: ' + typeShape)
  }

  _typeName (typeShape) {
    if (Array.isArray(typeShape)) {
      return '[' + this._typeName(typeShape[0]) + ']'
    }

    return typeShape.name || `${typeShape}`
  }

  _valDescription (valDescription) {
    return Array.isArray(valDescription)
      ? `[${valDescription}]`
      : `${valDescription}`
  }
}

/**
 * Type has shape {name: 'NAME', check: x => Boolean}
 */
Naqed.types = objectFromEntries(
  Object.entries({
    BOOL: b => typeof b === 'boolean',
    FLOAT: n => `${n}` === `${parseFloat(n)}` && !isNaN(n),
    ID: n => typeof n === 'string' && !!n.trim(),
    INT: n => `${n}` === `${parseInt(n, 10)}` && !isNaN(n),
    STRING: str => typeof str === 'string'
  }).map(([name, check]) => [name, { name, check }])
)

module.exports = Naqed
