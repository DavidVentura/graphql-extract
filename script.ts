
import { readFileSync } from "node:fs";
import { Filter, neededTypes, pruneSchema } from "./index.js";
import { parse, print } from "graphql";

const data = readFileSync("./schema.graphql", "utf-8");

// const filter: Filter = {
//     "User": { // Type
//         keep: ["fullName", "roles", "assignedTo"] // Type fields
//     },
//     "ThreadAssignee": { // Union
//         keep: ["User", "MachineUser"] // Union members
//     },
//     "UpsertTenantInput": {
//         exclude: ["identifier"]
//     }
// }
const filter: Filter = {
    "Mutation": { // Type
        include: [
            "createThread",
            "upsertTenant",
            "updateTenantTier",
            "setCustomerTenants",
            "upsertCustomer",
            "createAttachmentUploadUrl",
            "markThreadAsDone"
        ]
    },
    "Query": {
        include: [
            "searchTenants",
            "thread"
        ]
    },
    "Tier": {
        include: ["id", "name", "externalId"]
    },
    "Tenant": {
        exclude: [
            "createdBy",
            "updatedBy",
        ]
    },
    "Attachment": {
        include: ['id']
    },
    "ThreadField": {
        exclude: ['createdBy', 'updatedBy']
    },
    "Thread": {
        exclude: [
            "firstInboundMessageInfo",
            "firstOutboundMessageInfo",
            "lastInboundMessageInfo",
            "lastOutboundMessageInfo",
            "timelineEntries",
            "serviceLevelAgreementStatus",
            "links",
            "assignedTo",
            "statusDetail",
            "labels",
            "statusChangedBy",
            "createdBy",
            "updatedBy",
        ]
    },
    "Customer": {
        exclude: [
            "customerGroupMemberships",
            "status",
            "company",
            "assignedToUser",
            "createdBy",
            "updatedBy",
            "markedAsSpamBy",
        ]
    },
    "TenantTierMembership": {
        exclude: [
            "createdBy", "updatedBy"
        ]
    },
    "CustomerTenantMembership": {
        include: ['tenant']
    }

}

const filter2: Filter = {
    Attachment: {

    }
}
const pruned = pruneSchema(data, filter);
console.log(print(pruned));

const asDotGraph = () => {
    const nt = neededTypes(parse(data), filter).tree;
    const builtins = new Set(['Boolean', 'String', 'ID', 'DateTime', 'Int']);
    console.log("digraph {")
    Object.keys(nt).forEach(key => {
        const label = nt[key].join("|");
        console.log(`subgraph cluster_${key} {
        label="${key}"
    `)
        nt[key].filter(key => !builtins.has(key)).forEach(val => {
            if (nt[val]) {
                console.log(`${key} -> ${val};`)
            }
        }
        )
        console.log(`}`)
    })
    console.log("}")
};