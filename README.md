# Naqed

## What is it?

Naqed is a naked version of GraphQL.

Naqed is an experiment to distill GraphQL down to its core idea (Graph Querying, IMO) and then to build back up what's needed to make it useful again.

**Current Status**: It's 1 days old... so it's less than robust, but it does have 100% test coverage if you're into that kind of thing.

##  Installation

``` bash
npm install --save naqed
```

## Example 4 - Adding typechecking

``` js
const Naqed = require('naqed')

const employees = [{
    id: 'e1',
    departmentId: 'd1',
    name: 'Alice',
    salary: 60000
}, {
    id: 'e2',
    departmentId: 'd2',
    name: 'Bob',
    salary: 50000
}]

const departments = [{
    id: 'd1',
    name: 'QA'
}, {
    id: 'd2',
    name: 'Dev'
}]

// Setup the complex types
const EmployeeType = {
  id: ID,
  name: STRING,
  departmentId: STRING,
  // relate employee to their department
  department: {
    async $Department () {
      return departments.find(d => d.id === this.departmentId)
    }
  }
}

const DepartmentType = {
  id: ID,
  name: STRING,
  // Relate departments to their employees
  employees: {
    async $Employee () {
      return employees.find(e => e.departmentId === this.id)
    }
  }
}

// Create a Naqed instance
// 1st argument is resolver spec
// 2nd argument is a map from Typenames to Type Definitions
const n = new Naqed(
  {
    // Defines a top level resolver called employee which accepts an id as an argument 
    employee: {
      // This is how the type is specified
      $Employee ({ id }) {
        return employees.find(e => e.id === id)
      }
    },
    // Defines a top level resolver that returns an array of departments
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

  console.log(util.inspect(result, false, null, true))
}

```

