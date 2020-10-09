export interface Scalar {
  name: string
  check(val: any): boolean
}

export const ANY: Scalar = {
  name: 'ANY',
  check: (_a: any) => true
}
export const BOOL: Scalar = {
  name: 'BOOL',
  check: (b: any) => typeof b === 'boolean'
}

export const FLOAT: Scalar = {
  name: 'FLOAT',
  check: (n: any) => `${n}` === `${parseFloat(n)}` && !isNaN(n)
}

export const ID: Scalar = {
  name: 'ID',
  check: (n: any) => typeof n === 'string' && !!n.trim()
}

export const INT = {
  name: 'INT',
  check: (n: any) => `${n}` === `${parseInt(n, 10)}` && !isNaN(n)
}

export const STRING: Scalar = {
  name: 'STRING',
  check: (str: any) => typeof str === 'string'
}
