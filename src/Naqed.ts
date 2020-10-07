import { asyncSeries, reconstruct, reconstructAsync } from './lib/reconstruct'
import pluckKeys from './lib/pluck-keys'
import * as scalars from './scalars'
import { TypeChecker } from './TypeChecker'
import { parseTypeSpec } from './parse-typespec'

const isFunction = (x: any) => typeof x === 'function'
const isObject = (x: any) => x && !Array.isArray(x) && typeof x === 'object'
const isUndefined = (x: any) => typeof x === 'undefined'
const isTypeError = (x: any) => x instanceof TypeError
const hasMatchingKey = (x: Record<string, any>, regex: RegExp) =>
  Object.keys(x).some(key => key.match(regex))
const hasDynamicFn = (x: Record<string, any>) =>
  hasMatchingKey(x, /^\$([A-Z]|$)/)

const extractArgs = pluckKeys(
  (keyName: string) => keyName.match(/^\$[^A-Z]/) && keyName.substr(1)
)

const extractArgTypes = (
  args: Record<string, any>,
  spec: Record<string, any>
) =>
  reconstruct(args, ([argName]) => {
    const argType = spec[`$${argName}`]
    return argType && [argName, argType]
  })

const extractDynamicMethods = pluckKeys(
  (key: string) => key.match(/^\$([A-Z]|$)/i) && key
)
const extractNonArgs = pluckKeys((keyName: string) => !keyName.startsWith('$'))

const isScalarType = (obj: any) => Object.values(Naqed.scalars).includes(obj)
const hasQuery = (request: Request) => hasMatchingKey(request, /^[^~]/)
const hasMutation = (request: Request) => hasMatchingKey(request, /^[~]/)

type Spec = Record<string, any>
type Request = Record<string, any>
type Vars = Record<string, any>

type RequestOptions = {
  context?: any
  vars?: Vars
}

export class Naqed {
  private _spec: Spec
  private _customTypes: Record<string, any>
  private _typeChecker: TypeChecker
  private _types: Record<string, any>
  private _typePrototypes: Record<string, any>

  constructor (spec: Spec) {
    // Remove keys that start with $ since they are used to specify custom types
    this._spec = reconstruct(spec, ([key, _val]) => !key.startsWith('$'))

    this._customTypes = this.extractCustomTypes(spec)

    this._types = Object.assign({}, this._customTypes, Naqed.scalars)

    this._typeChecker = new TypeChecker(this._types)

    this._typePrototypes = this.extractTypePrototypes()

    this.lintSpecTypes(this._spec)
  }

  private extractCustomTypes (spec: Record<string, any>): Record<string, any> {
    return reconstruct(spec, ([key, val]) => {
      if (!key.startsWith('$')) return false

      if (isScalarType(val)) {
        // this is an alias for a scalar, so clone it
        val = Object.assign({}, val, { name: key.substr(1) })
      }

      return [key.substr(1), val]
    })
  }

  private extractTypePrototypes (): Record<string, any> {
    return reconstruct(this._customTypes, ([typeName, typeSpec]) => [
      typeName,
      this.extractTypePrototype(typeSpec)
    ])
  }

  // extracts an object from the specified type that will be used as the
  // prototype for objects generated that are supposed to be this type.
  // this is useful for relations
  private extractTypePrototype (typeSpec: any): any {
    return reconstruct(typeSpec, ([prop, propSpec]) => {
      if (isFunction(propSpec)) return true // keep methods
      if (isScalarType(propSpec)) return false // ignore scalar types
      if (!isObject(propSpec)) return false // ignore non-objects

      const [relatedName] = Object.keys(propSpec)
      if (!relatedName.startsWith('$')) return false

      // TODO: write test to cover this line
      return [prop, propSpec]
    })
  }

  private lintSpecTypes (spec: Spec, seen = new Set()) {
    if (typeof spec === 'string') {
      parseTypeSpec(spec, this._types)
      return
    }

    if (Array.isArray(spec)) {
      spec.forEach(s => seen.has(s) || this.lintSpecTypes(s, seen.add(s)))
      return
    }

    if (isObject(spec)) {
      if (spec.check) return
      this.lintStructuredObject(spec, seen)
    }
  }

  private lintStructuredObject (spec: Record<string, any>, seen: Set<unknown>) {
    Object.entries(spec).forEach(([key, val]) => {
      if (typeof val === 'function') {
        if (key !== '$' && key.startsWith('$')) {
          parseTypeSpec(key, this._types)
        }
      } else if (key.startsWith('~')) {
        if (
          typeof val !== 'function' &&
          (!isObject(val) || !hasDynamicFn(val))
        ) {
          throw new Error('mutation.invalid')
        }
      } else if (!seen.has(val)) {
        this.lintSpecTypes(val, seen.add(val))
      }
    })
  }

  public async request (q: Request, options: RequestOptions = {}) {
    const ctx = typeof options.context === 'undefined' ? {} : options.context
    const vars = options.vars || {}

    if (q._vars) {
      const check = this._typeChecker.check(vars, q._vars)
      const errors = reconstruct(check, ([_prop, result]) =>
        isTypeError(result)
      )

      if (Object.keys(errors).length) {
        return { _vars: errors }
      }

      q = this.bindVars(q, vars)
    }

    const isQuery = hasQuery(q)
    const isMutation = hasMutation(q)
    if (isQuery && isMutation) {
      throw new TypeError('cannot mix queries and mutations')
    }

    if (isQuery) {
      return await this.resolveQuery(this._spec, q, ctx)
    }

    if (isMutation) {
      return await this.resolveMutation(this._spec, q, ctx)
    }

    return new TypeError('request must either be a query or mutation')
  }

  private bindVars (q: Request, vars: Vars): Request {
    return reconstruct(q, ([prop, val]) => {
      if (prop === '_vars') return false

      if (typeof val === 'string' && val[0] === '_') {
        const varName = val.substr(1)
        if (typeof vars[varName] === 'undefined') {
          throw new Error('reference to unknown var: ' + varName)
        }
        return [prop, vars[varName]]
      }

      if (isObject(val) && !isScalarType(val)) {
        return [prop, this.bindVars(val, vars)]
      }

      return true
    })
  }

  private async resolveQuery (spec: Spec, query: Request, ctx: any) {
    const resolved = await reconstructAsync(
      query,
      async ([queryProp, queryVal]) => {
        if (queryVal !== true && !isObject(queryVal))
          throw new Error('invalid query value: ' + queryVal)

        let resolveVal = spec[queryProp]

        if (isUndefined(resolveVal)) return [queryProp, null]

        if (typeof resolveVal === 'function') {
          resolveVal = resolveVal.apply(spec, [extractArgs(queryVal), ctx])
          queryVal = extractNonArgs(queryVal)
        } else if (isObject(resolveVal) && hasDynamicFn(resolveVal)) {
          const resolution = await this.performDynamicResolution(
            resolveVal,
            queryVal,
            ctx
          )
          if (isTypeError(resolution.resolveVal))
            return [queryProp, resolution.resolveVal]

          resolveVal = resolution.resolveVal
          queryVal = resolution.queryVal
        }

        return [queryProp, await this.prepareResult(resolveVal, queryVal, ctx)]
      }
    )

    return this._typeChecker.check(resolved, this._spec)
  }

  private async resolveMutation (spec: Spec, query: Request, ctx: any) {
    const resolved = await asyncSeries(query, async ([queryProp, queryVal]) => {
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
      } else {
        const resolution = await this.performDynamicResolution(
          resolveVal,
          queryVal,
          ctx
        )
        resolveVal = resolution.resolveVal
        queryVal = resolution.queryVal
      }

      return [mutationName, await this.prepareResult(resolveVal, queryVal, ctx)]
    })

    return this._typeChecker.check(resolved, this._spec)
  }

  private async performDynamicResolution (
    resolverVal: any,
    queryVal: any,
    ctx: any
  ) {
    const dynamic = extractDynamicMethods(resolverVal)

    const typeSpec = Object.keys(dynamic)[0]
    const { typeName } = parseTypeSpec(typeSpec, this._types)
    const dynamicFn = dynamic[typeSpec]
    const shape =
      typeName === 'ANY'
        ? extractNonArgs(resolverVal)
        : this._typePrototypes[typeName]

    let resolved = dynamicFn
    if (isFunction(dynamicFn)) {
      // Check query args against types
      const args = extractArgs(queryVal)
      const argsTypes = extractArgTypes(args, resolverVal)

      for (const [argName, type] of Object.entries(argsTypes)) {
        const checkedArg = this._typeChecker.check(args[argName], type)
        if (isTypeError(checkedArg)) {
          return { resolveVal: checkedArg, queryVal }
        }

        if (Array.isArray(checkedArg) && checkedArg.some(isTypeError)) {
          return {
            resolveVal: new TypeError(
              `invalid ${type.substr(1)} arg ${argName}: [${args[argName]}]`
            ),
            queryVal
          }
        }
      }

      resolved = await dynamicFn.apply(null, [args, ctx])

      // Anything non-meta on the queryVal needs to be plucked from the response still
      queryVal = reconstruct(queryVal, ([prop]) => prop[0] !== '$')
    }

    if (Array.isArray(resolved)) {
      resolverVal = resolved.map(obj =>
        isObject(obj) ? Object.assign(Object.create(shape), obj) : obj
      )
    } else if (isObject(resolved)) {
      resolverVal = Object.assign(Object.create(shape), resolved)
    } else {
      resolverVal = resolved
    }

    return { resolveVal: resolverVal, queryVal }
  }

  private async prepareResult (
    resolveVal: any,
    queryVal: any,
    ctx: any
  ): Promise<any> {
    if (resolveVal && resolveVal.then) {
      resolveVal = await resolveVal
    }

    if (!isObject(queryVal) || Object.keys(queryVal).length === 0)
      return resolveVal

    if (Array.isArray(resolveVal))
      return Promise.all(
        resolveVal.map(rv => this.resolveQuery(rv, queryVal, ctx))
      )

    return this.resolveQuery(resolveVal, queryVal, ctx)
  }

  static scalars = scalars
}
