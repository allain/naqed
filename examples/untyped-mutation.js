const Naqed = require('naqed')

async function main () {
  const logs = []

  // Naqed receives a resolver graph
  const n = new Naqed({
    // query
    logs () {
      return logs
    },

    // mutation
    '~log' ({ msg }) {
      logs.push(msg)
      return true
    }
  })

  // the instance can be queried
  console.log(await n.request({ logs: true }))

  // the instance can be mutated
  console.log(await n.request({ '~log': { $msg: 'HELLO WORLD' } }))

  console.log(await n.request({ logs: true }))
}

main()
