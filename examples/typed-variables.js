const Naqed = require('../src/Naqed')
const { INT } = Naqed.types

async function main () {
  const n = new Naqed({
    add: {
      $ ({ a, b }) {
        return a + b
      },
      $a: INT,
      $b: INT
    }
  })

  // Query using variables
  console.log(
    await n.request(
      {
        _vars: {
          x: INT,
          y: INT
        },
        add: { $a: '_x', $b: '_y' }
      },
      {
        vars: {
          x: 10,
          y: 20
        }
      }
    )
  )
}

main()
