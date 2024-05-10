
import { readFileSync } from "node:fs";
import { Filter, pruneSchema } from "./index.js";
import { print } from "graphql";

const data = readFileSync("./schema.graphql", "utf-8");

const filter: Filter = {
    "User": {
        keep: ["fullName", "roles", "assignedTo"]
    },
    "ThreadAssignee": {
        keep: ["User", "MachineUser"]
    }
}
const pruned = pruneSchema(data, filter);
console.log("ast", print(pruned));
