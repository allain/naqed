export const ANY = {
  name: 'ANY',
  check: (_a: any) => true
}

export const BOOL = {
  name: 'BOOL',
  check: (b: any) => typeof b === 'boolean'
}

export const FLOAT = {
  name: 'FLOAT',
  check: (n: any) => `${n}` === `${parseFloat(n)}` && !isNaN(n)
}

export const ID = {
  name: 'ID',
  check: (n: any) => typeof n === 'string' && !!n.trim()
}

export const INT = {
  name: 'INT',
  check: (n: any) => `${n}` === `${parseInt(n, 10)}` && !isNaN(n)
}

export const STRING = {
  name: 'STRING',
  check: (str: any) => typeof str === 'string'
}
