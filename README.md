# Naqed

## What is it?

Naqed is an **experiment** to strip down all of the abstraction around GraphQL. 

* It uses JSON as the interop, rather than the GraphQL language. 
* It has optional types
* It supports defining custom types (and scalars) in a simple way.

## Installation

```bash
npm install --save naqed
```

## Type-less Usage

```js
const Naqed = require('naqed')

// Naqed receives a resolver graph
const n = new Naqed({
  now() {
    return Date.now()
  }
})

// the instance can be queried
const result = await n.request({now: true})

console.log(result) // result contains {now: TIMESTAMP}
```

## Examples

Can be found in the examples directory of the repo.

