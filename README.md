# Naqed

## What is it?

Naqed is an **experiment** to strip down all of the abstraction around GraphQL.

- It uses JSON as the interop, rather than the GraphQL language.
- It has optional types
- It supports defining custom types (and scalars) in a simple way.
- It supports mutations
- It supports variables

## Installation

```bash
npm install --save naqed
```

## Type-less Usage

```js
const Naqed = require("naqed");

const logs = [];

// Naqed receives a resolver graph
const n = new Naqed({
  //query
  logs() {
    return logs;
  },

  // mutation
  "~log"({ msg }) {
    logs.push(msg);
  },
});

// the instance can be queried
const result = await n.request({ logs: true }); // {logs: []}

await n.request({ "~log": { msg: "HELLO WORLD" } });

const result = await n.request({ logs: true }); // {logs: ['HELLO WORLD']}
```

## Examples

Can be found in the examples directory of the repo.
