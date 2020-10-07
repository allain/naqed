import pluckKeys from './lib/pluck-keys'
import { reconstruct } from './lib/reconstruct'
import { parseTypeSpec } from './parse-typespec'

const isTypeError = (x: any) => x instanceof TypeError
const isObject = (x: any) => x && !Array.isArray(x) && typeof x === 'object'
const isEmpty = (x: any) => x === null || typeof x === 'undefined'
const extractDynamicMethods = pluckKeys(
  (key: string) => key.match(/^\$([A-Z]|$)/i) && key
)

export class TypeChecker {
  private _types: Record<string, any>

  constructor (types: Record<string, any>) {
    this._types = types
  }

  public check (value: any, spec: any): any {
    if (isTypeError(value)) return value

    if (typeof spec === 'string') {
      const { type, isArray, required } = parseTypeSpec(spec, this._types)
      if (!required && isEmpty(value)) return value

      spec = isArray ? [type] : type
    }

    if (Array.isArray(spec)) {
      return Array.isArray(value)
        ? value.map(val => this.check(val, spec[0]))
        : new TypeError('invalid Array: ' + value)
    }

    if (!isObject(spec)) return value

    const checkedScalar = this._checkScalar(value, spec)
    if (checkedScalar !== null) return checkedScalar

    const checkedDynamic = this.checkDynamicResolver(value, spec)
    if (checkedDynamic !== null) return checkedDynamic

    if (value === null) return null

    return this.checkStructuredType(value, spec)
  }

  private _checkScalar (value: any, spec: any) {
    if (!spec.check) return null

    return spec.check(value)
      ? value
      : new TypeError(`invalid ${spec.name}: ${value}`)
  }

  private checkDynamicResolver (value: any, spec: any) {
    const dynamic = extractDynamicMethods(spec)
    if (!Object.keys(dynamic).length) return null

    const { type, typeName, isArray, required } = parseTypeSpec(
      Object.keys(dynamic)[0],
      this._types
    )
    if (isEmpty(value)) {
      if (required) return new TypeError(`missing ${typeName}`)

      return value
    }

    if (typeName && !type) throw new TypeError(`unknown type: ${typeName}`)

    if (isArray) {
      return Array.isArray(value)
        ? value.map(val => this.check(val, type))
        : new TypeError('invalid Array: ' + value)
    }

    return this.check(value, type)
  }

  private checkStructuredType (value: Record<string, any>, spec: any) {
    return reconstruct(value, ([prop, val]) => {
      if (spec[prop]) return [prop, this.check(val, spec[prop])]
      if (spec['~' + prop]) return [prop, this.check(val, spec['~' + prop])]

      // If the object does not say anything about this prop, then pass it through
      return [prop, val]
    })
  }
}
