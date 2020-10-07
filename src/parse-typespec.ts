export function parseTypeSpec (typeSpec: string, types: Record<string, any>) {
  if (typeSpec === '$') {
    return {
      type: types.ANY,
      typeName: 'ANY',
      required: false,
      isArray: false
    }
  }

  const match = typeSpec.match(/^\$([A-Z]+)(\[\])?([!])?$/i)
  if (!match) throw new TypeError('invalid type spec: ' + typeSpec)

  const [, typeName, isArray, required] = match

  const type = types[typeName]
  if (!type) throw new TypeError('unknown type: ' + typeName)

  return { type, typeName, isArray, required }
}
