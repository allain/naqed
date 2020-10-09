const { Naqed } = require('naqed')
const { STRING } = Naqed.scalars

async function main () {
  const logs = []

  // Naqed receives a resolver graph
  const n = new Naqed({
    $Log: STRING,
    // query
    logs: {
      '$Log[]' () {
        return logs
      }
    },

    // mutation
    '~log': {
      $BOOL ({ msg }) {
        logs.push(msg)
        return true
      },
      $msg: '$STRING!'
    }
  })

  // the instance can be queried
  console.log(await n.request({ logs: true }))

  // the instance can be mutated
  console.log(await n.request({ '~log': { $msg: 'HELLO WORLD' } }))

  console.log(await n.request({ logs: true }))
}

main()
