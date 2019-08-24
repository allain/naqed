module.exports = {
  BOOL: {
    name: 'BOOL',
    check: b => typeof b === 'boolean'
  },
  FLOAT: {
    name: 'FLOAT',
    check: n => `${n}` === `${parseFloat(n)}` && !isNaN(n)
  },
  ID: {
    name: 'ID',
    check: n => typeof n === 'string' && !!n.trim()
  },
  INT: {
    name: 'INT',
    check: n => `${n}` === `${parseInt(n, 10)}` && !isNaN(n)
  },
  STRING: {
    name: 'STRING',
    check: str => typeof str === 'string'
  }
}
