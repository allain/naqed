const recon = require('./lib/reconstruct')

const isFunction = x => typeof x === 'function'
const isObject = x => x && !Array.isArray(x) && typeof x === 'object'
const isUndefined = x => typeof x === 'undefined'

const pluckKeys = require('./lib/pluck-keys')

const extractArgs = pluckKeys(
  keyName => keyName.match(/^\$[^A-Z]/) && keyName.substr(1)
)
const extractDynamicFn = pluckKeys(
  keyName => keyName.match(/^\$([A-Z]|$)/) && keyName.substr(1)
)
const extractNonArgs = pluckKeys(keyName => !keyName.startsWith('$'))

class Naqed {
  constructor (spec, types = {}) {
    this.spec = spec

    this.types = types

    this.typeRelations = recon(types, ([typeName, typeSpec]) => [
      typeName,
      recon(typeSpec, ([prop, propSpec]) => {
        if (!isObject(propSpec)) return false
        const [relatedName, ...extra] = Object.keys(propSpec)
        if (!relatedName.startsWith('$')) return false

        return [prop, propSpec]
      })
    ])
  }

  async query (q, ctx = {}) {
    const resolved = await this._resolveQuery(this.spec, q, ctx)

    return this.spec.__type
      ? this._applyTypeShape(this.spec.__type, resolved)
      : resolved
  }

  async _resolveQuery (spec, query, ctx) {
    return recon.async(query, async ([queryProp, queryVal]) => {
      if (
        queryVal !== true &&
        !isObject(queryVal) &&
        (typeof queryVal !== 'string' || queryVal.startsWith('$'))
      ) {
        throw new Error('invalid query value: ' + queryVal)
      }

      let resolveVal = spec[queryProp]

      if (isUndefined(resolveVal)) {
        return [queryProp, null]
      }

      if (typeof resolveVal === 'function') {
        resolveVal = resolveVal.apply(spec, [extractArgs(queryVal), ctx])
        queryVal = extractNonArgs(queryVal)
      } else if (isObject(resolveVal)) {
        const dynamic = extractDynamicFn(resolveVal)
        if (Object.keys(dynamic).length) {
          const typeName = Object.keys(dynamic)[0]
          const dynamicFn = dynamic[typeName]
          // resolver with dynamic shape for results
          const shape = typeName
            ? this.typeRelations[typeName]
            : extractNonArgs(resolveVal)

          const resolved = await (isFunction(dynamicFn)
            ? dynamicFn.apply(spec, [extractArgs(queryVal), ctx])
            : dynamicFn)
          if (Array.isArray(resolved)) {
            resolveVal = resolved.map(obj =>
              isObject(obj) ? Object.assign(Object.create(shape), obj) : obj
            )
          } else if (isObject(resolved)) {
            resolveVal = Object.assign(Object.create(shape), resolved)
          } else {
            resolveVal = resolved
          }
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

      if (spec[queryProp].__type) {
        resolveVal = this._applyTypeShape(spec[queryProp].__type, resolveVal)
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
      return recon(
        value,
        ([prop, val]) =>
          typeShape[prop] && [prop, this._applyTypeShape(typeShape[prop], val)]
      )
    }

    throw new TypeError('invalid typeshape provided: ' + typeShape)
  }
}

Naqed.types = require('./types')

module.exports = Naqed
