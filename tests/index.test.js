import assert from "assert";
import { print, parse } from "graphql";
import { pruneSchema } from "../index.js";

describe("schema pruning", () => {
  it("Simple exclude/include", () => {
    const schema = `
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
}`;
    const filter = {
      First: {
        include: ["second"],
      },
      Second: {
        exclude: ["third"],
      },
    };
    const expected = parse(`
type First {
  second: Second!
}
type Second {
  name: String!
}`);
    const got = pruneSchema(schema, filter);
    assert.deepEqual(print(got), print(expected));
  });
});
