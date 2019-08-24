const recon = require('./lib/reconstruct')

const isObject = x => x && !Array.isArray(x) && typeof x === 'object'
const isUndefined = x => typeof x === 'undefined'

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
    return recon.async(query, async ([queryProp, queryVal]) => {
      if (queryVal !== true && !isObject(queryVal)) {
        throw new Error('invalid query value: ' + queryVal)
      }

      let resolveVal = spec[queryProp]

      if (isUndefined(resolveVal)) {
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
  }

  // Replaces all type mismatches with new TypeError('invalid TYPENAME: VALUE')
  _applyTypeShape (typeShape, value) {
    if (Array.isArray(typeShape)) {
      return Array.isArray(value)
        ? value.map(v => this._applyTypeShape(typeShape[0], v))
        : new TypeError('invalid Array')
    }

    if (typeShape.check) {
      return typeShape.check(value)
        ? value
        : new TypeError(`invalid ${typeShape.name}: ${value}`)
    }

    if (typeof typeShape === 'object') {
      return recon(value, ([prop, val]) =>
        typeShape[prop]
          ? [prop, this._applyTypeShape(typeShape[prop], val)]
          : null
      )
    }

    throw new TypeError('invalid typeshape provided: ' + typeShape)
  }
}

Naqed.types = require('./types')

module.exports = Naqed
