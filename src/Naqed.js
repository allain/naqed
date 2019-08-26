const recon = require('./lib/reconstruct')

const isFunction = x => typeof x === 'function'
const isObject = x => x && !Array.isArray(x) && typeof x === 'object'
const isUndefined = x => typeof x === 'undefined'

const pluckKeys = require('./lib/pluck-keys')

const extractArgs = pluckKeys(
  keyName => keyName.match(/^\$[^A-Z]/) && keyName.substr(1)
)

const extractArgTypes = (args, spec) =>
  Object.keys(args).reduce((argTypes, argName) => {
    const argType = spec[`$${argName}`]
    if (argType) {
      argTypes[argName] = argType
    }
    return argTypes
  }, {})

const extractDynamicFn = pluckKeys(
  keyName => keyName.match(/^\$([A-Z]|$)/i) && keyName.substr(1)
)
const extractNonArgs = pluckKeys(keyName => !keyName.startsWith('$'))

const isScalarType = obj => Object.values(Naqed.types).includes(obj)

class Naqed {
  constructor (spec = {}) {
    // Remove keys that start with $ since they are used to speficy custom types
    this.spec = recon(spec, ([key, val]) => !key.startsWith('$'))
    const customTypes = Object.assign(
      recon(spec, ([key, val]) => {
        if (!key.startsWith('$')) return false

        if (isScalarType(val)) {
          // this is an alias
          val = Object.assign({}, val, { name: key.substr(1) })
        }

        return [key.substr(1), val]
      })
    )

    this.types = Object.assign({}, customTypes, Naqed.types)

    this.typePrototypes = recon(customTypes, ([typeName, typeSpec]) => [
      typeName,
      recon(typeSpec, ([prop, propSpec]) => {
        if (isFunction(propSpec)) return true
        if (isScalarType(propSpec)) return false
        if (!isObject(propSpec)) return false

        const [relatedName, ...extra] = Object.keys(propSpec)
        if (!relatedName.startsWith('$')) return false

        return [prop, propSpec]
      })
    ])
  }

  async query (q, ctx = {}) {
    return await this._resolveQuery(this.spec, q, ctx)
  }

  async _resolveQuery (spec, query, ctx) {
    const resolved = await recon.async(query, async ([queryProp, queryVal]) => {
      if (
        queryVal !== true &&
        !isObject(queryVal) &&
        (typeof queryVal !== 'string' || queryVal.startsWith('$'))
      ) {
        throw new Error('invalid query value: ' + queryVal)
      }

      let resolveVal = spec[queryProp]

      if (isUndefined(resolveVal)) return [queryProp, null]

      if (typeof resolveVal === 'function') {
        resolveVal = resolveVal.apply(spec, [extractArgs(queryVal), ctx])
        queryVal = extractNonArgs(queryVal)
      } else if (isObject(resolveVal)) {
        const dynamic = extractDynamicFn(resolveVal)

        if (Object.keys(dynamic).length) {
          const typeSpec = Object.keys(dynamic)[0]
          const [typeName, isArray] = typeSpec.endsWith('[]')
            ? [typeSpec.replace(/\[\]$/, ''), true]
            : [typeSpec, false]

          const dynamicFn = dynamic[typeSpec]
          const shape = typeName
            ? this.typePrototypes[typeName]
            : extractNonArgs(resolveVal)

          let resolved = dynamicFn
          if (isFunction(dynamicFn)) {
            const args = extractArgs(queryVal)
            const argsTypes = extractArgTypes(args, spec[queryProp])
            for (const [argName, type] of Object.entries(argsTypes)) {
              const checkedArg = this._check(args[argName], type)
              if (checkedArg instanceof TypeError) {
                return [queryProp, checkedArg]
              }
            }

            resolved = await dynamicFn.apply(spec, [args, ctx])
            queryVal = recon(queryVal, ([prop]) => prop[0] !== '$')
          }

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

      return [queryProp, resolveVal]
    })

    return this._check(resolved, this.spec)
  }

  _check (value, spec) {
    if (value instanceof TypeError) return value
    if (!isObject(spec)) return value

    const checkedScalar = this._checkScalar(value, spec)
    if (checkedScalar !== null) return checkedScalar

    const checkedDynamic = this._checkDynamicResolver(value, spec)
    if (checkedDynamic !== null) return checkedDynamic

    return this._checkStructuredType(value, spec)
  }

  _checkScalar (value, spec) {
    if (!spec.check) return null

    return spec.check(value)
      ? value
      : new TypeError(`invalid ${spec.name}: ${value}`)
  }

  _checkDynamicResolver (value, spec) {
    const dynamic = extractDynamicFn(spec)
    if (!Object.keys(dynamic).length) return null

    const typeSpec = Object.keys(dynamic)[0]
    const [typeName, isArray] = typeSpec.endsWith('[]')
      ? [typeSpec.replace(/\[\]$/, ''), true]
      : [typeSpec, false]

    const type = this.types[typeName]
    if (typeName && !type) return new TypeError(`unknown type: ${typeName}`)

    if (isArray) {
      return Array.isArray(value)
        ? value.map(val => this._check(val, type))
        : new TypeError('invalid Array: ' + value)
    }

    return this._check(value, type)
  }

  _checkStructuredType (value, spec) {
    return recon(value, ([prop, val]) => {
      if (spec[prop]) return [prop, this._check(val, spec[prop])]

      // If the object does not say anything about this prop, then pass it through
      return [prop, val]
    })
  }
}

Naqed.types = require('./types')

module.exports = Naqed
