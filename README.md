# GraphQL-extract

This library lets you prune a GraphQL schema, meaning that you can select which `type`s you want to keep and it will recursively remove everything that's not necessary.

On kept types, you can also selectively include/exclude fields, to further prune the schema.

Example:

```graphql
type First {
  id: ID!
  second: Second!
}
type Second {
  name: String!
  third: Third!
}
type Third {
  name: String!
  otherField: String!
}
```

With this filter:

```ts
const filter: Filter = {
  First: {
    include: ["second"],
  },
  Second: {
    exclude: ["third"],
  }
};
```

results in this schema

```graphql
type First {
  second: Second!
}
type Second {
  name: String!
}
```
