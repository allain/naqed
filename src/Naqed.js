const recon = require('./lib/reconstruct')
const pluckKeys = require('./lib/pluck-keys')

const isEmpty = x => x === null || typeof x === 'undefined'
const isFunction = x => typeof x === 'function'
const isObject = x => x && !Array.isArray(x) && typeof x === 'object'
const isUndefined = x => typeof x === 'undefined'
const hasMatchingKey = (x, regex) =>
  Object.keys(x).some(key => key.match(regex))
const hasDynamicFn = x => hasMatchingKey(x, /^\$([A-Z]|$)/)

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
  keyName => keyName.match(/^\$([A-Z]|$)/i) && keyName
)
const extractNonArgs = pluckKeys(keyName => !keyName.startsWith('$'))

const isScalarType = obj => Object.values(Naqed.types).includes(obj)
const hasQuery = request =>
  Object.keys(request).some(topLevelKey => !topLevelKey.startsWith('~'))
const hasMutation = request =>
  Object.keys(request).some(topLevelKey => topLevelKey.startsWith('~'))

class Naqed {
  constructor (spec) {
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

    this.customTypes = customTypes

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

    this._checkTypes(this.spec)
  }

  _checkTypes (spec, seen = new Set()) {
    if (typeof spec === 'string') {
      this._parseTypeSpec(spec)
    } else if (Array.isArray(spec)) {
      spec.forEach(s => seen.has(s) || this._checkTypes(s, seen.add(s)))
    } else if (isObject(spec)) {
      if (spec.check) return
      Object.entries(spec).forEach(([key, val]) => {
        if (typeof val === 'function') {
          if (key !== '$' && key.startsWith('$')) {
            this._parseTypeSpec(key)
          }
        } else if (!seen.has(val)) {
          this._checkTypes(val, seen.add(val))
        }
      })
    }
  }

  async request (q, options = {}) {
    const ctx = typeof options.context === 'undefined' ? {} : options.context
    const vars = options.vars || {}

    if (q._vars) {
      const check = this._check(vars, q._vars)
      const errors = recon(
        check,
        ([prop, result]) => result instanceof TypeError
      )

      if (Object.keys(errors).length) {
        return { _vars: errors }
      }

      q = this._bindVars(q, vars)
    }

    const isQuery = hasQuery(q)
    const isMutation = hasMutation(q)
    if (isQuery && isMutation) {
      throw new TypeError('cannot mix queries and mutations')
    } else if (isQuery) {
      return await this._resolveQuery(this.spec, q, ctx)
    } else if (isMutation) {
      return await this._resolveMutation(this.spec, q, ctx)
    } else {
      return new TypeError('request must either be a query or mutation')
    }
  }

  _bindVars (q, vars) {
    return recon(q, ([prop, val]) => {
      if (prop === '_vars') return false

      if (typeof val === 'string' && val[0] === '_') {
        const varName = val.substr(1)
        if (typeof vars[varName] === 'undefined') {
          throw new Error('reference to unknown var: ' + varName)
        }
        return [prop, vars[varName]]
      }
      if (isObject(val) && !isScalarType(val)) {
        return [prop, this._bindVars(val, vars)]
      }

      return true
    })
  }

  async _resolveQuery (spec, query, ctx) {
    const resolved = await recon.async(query, async ([queryProp, queryVal]) => {
      if (queryVal !== true && !isObject(queryVal)) {
        throw new Error('invalid query value: ' + queryVal)
      }

      let resolveVal = spec[queryProp]

      if (isUndefined(resolveVal)) return [queryProp, null]

      if (typeof resolveVal === 'function') {
        resolveVal = resolveVal.apply(spec, [extractArgs(queryVal), ctx])
        queryVal = extractNonArgs(queryVal)
      } else if (isObject(resolveVal)) {
        if (hasDynamicFn(resolveVal)) {
          const resolution = await this._performDynamicResolution(
            resolveVal,
            queryVal,
            ctx
          )
          if (resolution.resolveVal instanceof Error) {
            return [queryProp, resolution.resolveVal]
          }
          resolveVal = resolution.resolveVal
          queryVal = resolution.queryVal
        }
      }

      return [queryProp, await this._prepareResult(resolveVal, queryVal, ctx)]
    })

    return this._check(resolved, this.spec)
  }

  async _resolveMutation (spec, query, ctx) {
    const resolved = await recon.asyncSeries(
      query,
      async ([queryProp, queryVal]) => {
        const mutationName = queryProp.substr(1)

        // Unlike queries top level mutations must pass an object (its arguments)
        if (!isObject(queryVal)) {
          return [
            mutationName,
            new TypeError('invalid mutation args: ' + queryVal)
          ]
        }

        let resolveVal = spec[queryProp]

        if (isUndefined(resolveVal)) {
          return [
            mutationName,
            new TypeError('unknown mutation: ' + mutationName)
          ]
        }

        if (typeof resolveVal === 'function') {
          resolveVal = resolveVal.apply(spec, [extractArgs(queryVal), ctx])
          queryVal = extractNonArgs(queryVal)
        } else if (isObject(resolveVal)) {
          if (!hasDynamicFn(resolveVal)) {
            return [
              mutationName,
              new TypeError('no resolver found for mutation: ' + mutationName)
            ]
          }

          const resolution = await this._performDynamicResolution(
            resolveVal,
            queryVal,
            ctx
          )
          resolveVal = resolution.resolveVal
          queryVal = resolution.queryVal
        } else {
          return [
            mutationName,
            new TypeError('invalid mutation specification: ' + resolveVal)
          ]
        }

        return [
          mutationName,
          await this._prepareResult(resolveVal, queryVal, ctx)
        ]
      }
    )

    return this._check(resolved, this.spec)
  }

  async _performDynamicResolution (resolveVal, queryVal, ctx) {
    const dynamic = extractDynamicFn(resolveVal)

    const typeSpec = Object.keys(dynamic)[0]
    const { type, typeName, isArray, required } = this._parseTypeSpec(typeSpec)
    const dynamicFn = dynamic[typeSpec]
    const shape = typeName
      ? this.typePrototypes[typeName]
      : extractNonArgs(resolveVal)

    let resolved = dynamicFn
    if (isFunction(dynamicFn)) {
      // Check query args against types
      const args = extractArgs(queryVal)
      const argsTypes = extractArgTypes(args, resolveVal)
      for (const [argName, type] of Object.entries(argsTypes)) {
        const checkedArg = this._check(args[argName], type)
        if (checkedArg instanceof TypeError) {
          return { resolveVal: checkedArg, queryVal }
        }

        if (Array.isArray(checkedArg)) {
          const error = checkedArg.find(arg => arg instanceof TypeError)
          if (error) {
            return {
              resolveVal: new TypeError(
                `invalid ${type.substr(1)} arg ${argName}: [${args[argName]}]`
              ),

              queryVal
            }
          }
        }
      }

      resolved = await dynamicFn.apply(null, [args, ctx])

      // Anything non-meta on the queryVal needs to be plucked from the response still
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

    return { resolveVal, queryVal }
  }

  async _prepareResult (resolveVal, queryVal, ctx) {
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

    return resolveVal
  }

  _parseTypeSpec (typeSpec) {
    if (typeSpec === '$') return {}
    const match = typeSpec.match(/^\$([A-Z]+)(\[\])?([!])?$/i)
    if (!match) throw new TypeError('invalid type spec: ' + typeSpec)

    const [, typeName, isArray, required] = match
    const type = this.types[typeName]
    if (!type) throw new TypeError('unknown type: ' + typeName)

    return { type, typeName, isArray, required }
  }

  _check (value, spec) {
    if (value instanceof TypeError) return value

    if (typeof spec === 'string') {
      const { type, isArray, required } = this._parseTypeSpec(spec)
      if (!required && isEmpty(value)) return value

      spec = isArray ? [type] : type
    }

    if (Array.isArray(spec)) {
      return Array.isArray(value)
        ? value.map(val => this._check(val, spec[0]))
        : new TypeError('invalid Array: ' + value)
    }

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

    const { type, typeName, isArray, required } = this._parseTypeSpec(
      Object.keys(dynamic)[0]
    )
    if (isEmpty(value)) {
      if (required) return new TypeError(`missing ${typeName}`)

      return value
    }

    if (typeName && !type) throw new TypeError(`unknown type: ${typeName}`)

    if (isArray) {
      return Array.isArray(value)
        ? value.map(val => this._check(val, type))
        : new TypeError('invalid Array: ' + value)
    }

    return this._check(value, type)
  }

  // This when the
  _checkStructuredType (value, spec) {
    return recon(value, ([prop, val]) => {
      if (spec[prop]) return [prop, this._check(val, spec[prop])]
      if (spec['~' + prop]) return [prop, this._check(val, spec['~' + prop])]

      // If the object does not say anything about this prop, then pass it through
      return [prop, val]
    })
  }
}

Naqed.types = require('./types')

module.exports = Naqed
