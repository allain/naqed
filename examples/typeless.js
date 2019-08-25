const util = require('util')
const Naqed = require('../src/Naqed')

const employees = [
  {
    id: 'e1',
    departmentId: 'd1',
    name: 'Alice',
    salary: 60000
  },
  {
    id: 'e2',
    departmentId: 'd2',
    name: 'Bob',
    salary: 50000
  }
]

const departments = [
  {
    id: 'd1',
    name: 'QA'
  },
  {
    id: 'd2',
    name: 'Dev'
  }
]

async function main () {
  const n = new Naqed({
    // Defining custom types
    employee ({ id }) {
      return employees.find(e => e.id === id)
    },
    departments () {
      return departments
    },
    time () {
      return Date.now()
    }
  })

  const result = await n.query({
    time: true,
    departments: {
      id: true,
      name: true
    },
    employee: {
      $id: 'e1',
      id: true,
      name: true,
      departmentId: true
    }
  })

  console.log(util.inspect(result, false, null, true))
}

main()
