import { NaqedError } from './NaqedError'

const isObject = (x: any) => x && !Array.isArray(x) && typeof x === 'object'
const hasMatchingKey = (x: Record<string, any>, regex: RegExp) =>
  Object.keys(x).some(key => key.match(regex))
const hasDynamicFn = (x: Record<string, any>) =>
  hasMatchingKey(x, /^\$([A-Z]|$)/)

type Spec = Record<string, any>

export class Linter {
  private _types: Record<string, any>

  constructor (types: Record<string, any>) {
    this._types = types
  }

  public lint (spec: Spec) {
    this._lint(spec)
  }

  // used recursively to lint
  private _lint (spec: any, seen = new Set()) {
    if (typeof spec === 'string') {
      this._lintTypeSpec(spec)
      return
    }

    if (Array.isArray(spec)) {
      spec.forEach(s => seen.has(s) || this._lint(s, seen.add(s)))
      return
    }

    if (isObject(spec) && !spec.check) this._lintStructuredObject(spec, seen)
  }

  private _lintStructuredObject (
    spec: Record<string, any>,
    seen: Set<unknown>
  ) {
    Object.entries(spec).forEach(([key, val]) => {
      if (typeof val === 'function') {
        if (key !== '$' && key.startsWith('$')) {
          this._lintTypeSpec(key)
        }
      } else if (key.startsWith('~')) {
        if (
          typeof val !== 'function' &&
          (!isObject(val) || !hasDynamicFn(val))
        ) {
          throw new NaqedError('mutation.invalid', { name: key.substr(1) })
        }
        this._lintStructuredObject(val, seen)
      } else if (!seen.has(val)) {
        this._lint(val, seen.add(val))
      }
    })
  }

  private _lintTypeSpec (typeSpec: string) {
    const match = typeSpec.match(/^\$([A-Z]+)(\[\])?([!])?$/i)
    if (!match) throw new NaqedError('type.malformed', { typeSpec })

    const typeName = match[1]

    const type = this._types[typeName]
    if (!type) throw new NaqedError('type.unknown', { typeName })
  }
}
