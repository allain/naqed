const util = require('util')

const Naqed = require('../src/Naqed')
const { ID, STRING, FLOAT } = Naqed.types

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

// Setup the complex types
const EmployeeType = {
  id: ID,
  name: STRING,
  salary: FLOAT,
  departmentId: STRING,
  // relate employee to the department
  department: {
    $Department () {
      return departments.find(d => d.id === this.departmentId)
    }
  }
}

const DepartmentType = {
  id: ID,
  name: STRING,
  // Relate departments to their employees
  employees: {
    $Employee () {
      return employees.find(e => e.departmentId === this.id)
    }
  }
}

async function main () {
  const n = new Naqed(
    {
      employee: {
        $Employee ({ id }) {
          return employees.find(e => e.id === id)
        }
      },
      departments: {
        $Department () {
          return departments
        }
      }
    },
    {
      Employee: EmployeeType,
      Department: DepartmentType
    }
  )

  const result = await n.query({
    departments: {
      id: true,
      name: true,
      employees: {
        id: true,
        name: true,
        salary: true
      }
    },
    employee: {
      $id: 'e1',
      id: true,
      name: true,
      department: {
        name: true
      }
    }
  })
  console.log(JSON.stringify(result, null, 2))
}

main()
