# Naqed

## What is it?

Naqed is a naked version of GraphQL.

Naqed is an experiment to distill GraphQL down to its core idea (Graph Querying, IMO) and then to build back up what's needed to make it useful again.

**Current Status**: It's 1 days old... so it's less than robust, but it does have 100% test coverage if you're into that kind of thing.

## Step 0 - Install

``` bash
npm install --save naqed
```

## Example 1 - Querying a static object

TODO

## Example 2 - Querying a dynamic resolver with arguments

TODO

## Example 3 - Adding relationships

TODO

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

function loadEmployee({ id }) {
    return employees.find(e => e.id === id)
}

function loadEmployeeDepartments() {
  return departments.find(d => d.id === this.departmentId)
}

const n = new Naqed({
    employee: {
        $: loadEmployee
        department: {
            $: loadDepartments
            __type: {
                id: ID,
                name: STRING
            }
        }
        __type: {
            id: ID,
            name: STRING,
            salary: FLOAT,
            departmentId: STRING,
        }
    }
})
```

## Step 2 - run queries against it

``` js
const result = await n.query({
    employee: {
        name: true
    },
    departments: {
        id,
        name
    }
})

// .
```

