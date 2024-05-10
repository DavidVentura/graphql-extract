import {
    Kind, parse, visit, TypeNode,
    ObjectTypeDefinitionNode, FieldDefinitionNode, isTypeDefinitionNode, DocumentNode, NamedTypeNode, UnionTypeDefinitionNode
} from "graphql";

export type Filter = {
    [type: string]: {
        keep?: string[];
    };
};


const typeNameFromTypeNode = (t: TypeNode): string => {
    switch (t.kind) {
        case Kind.NAMED_TYPE:
            return t.name.value;
        case Kind.LIST_TYPE:
            return typeNameFromTypeNode(t.type);
        case Kind.NON_NULL_TYPE:
            return typeNameFromTypeNode(t.type);
    }
}


const fieldsToKeep = (n: ObjectTypeDefinitionNode, filter: Filter): readonly FieldDefinitionNode[] => {
    const f = filter[n.name.value];
    if (f === undefined || f.keep === undefined) {
        return n.fields || [];
    }
    return (n.fields || []).filter(field => f.keep.indexOf(field.name.value) !== -1);
};
const unionMembersToKeep = (n: UnionTypeDefinitionNode, filter: Filter): readonly NamedTypeNode[] => {
    const f = filter[n.name.value];
    if (f === undefined || f.keep === undefined) {
        return n.types || [];
    }
    return (n.types || []).filter(field => f.keep.indexOf(field.name.value) !== -1);
};

const neededTypes = (ast: DocumentNode, filter: Filter): Set<string> => {
    const neededTypes = new Set(Object.keys(filter));
    let changed = true;
    while (changed) {
        changed = false;
        visit(ast, {
            [Kind.OBJECT_TYPE_DEFINITION]: (node) => {
                if (!neededTypes.has(node.name.value)) {
                    return;
                }
                const fieldTypes = fieldsToKeep(node, filter).map(f => typeNameFromTypeNode(f.type));
                const toAdd = fieldTypes.filter(el => !neededTypes.has(el));
                if (toAdd.length > 0) {
                    changed = true;
                    toAdd.forEach(el => neededTypes.add(el));
                }
            },
            [Kind.UNION_TYPE_DEFINITION]: (node) => {
                if (!neededTypes.has(node.name.value)) {
                    return;
                }
                const fieldTypes = unionMembersToKeep(node, filter).map(f => f.name.value)
                console.log(node.name.value, fieldTypes)
                const toAdd = fieldTypes.filter(el => !neededTypes.has(el));
                if (toAdd.length > 0) {
                    changed = true;
                    toAdd.forEach(el => neededTypes.add(el));
                }
            }
        });
    }

    return neededTypes;
}

export const pruneSchema = (data: string, f: Filter): DocumentNode => {
    const ast = parse(data);
    const types = neededTypes(ast, f);
    const newAST = visit(ast, {
        [Kind.OBJECT_TYPE_DEFINITION]: (node, key, parent, path, ancestors) => {
            if (!types.has(node.name.value)) {
                return null; // delete node
            }
        },
        [Kind.ENUM_TYPE_DEFINITION]: (node, key, parent, path, ancestors) => {
            if (!types.has(node.name.value)) {
                return null; // delete node
            }
        },
        [Kind.INPUT_OBJECT_TYPE_DEFINITION]: (node, key, parent, path, ancestors) => {
            if (!types.has(node.name.value)) {
                return null; // delete node
            }
        },
        [Kind.INTERFACE_TYPE_DEFINITION]: (node, key, parent, path, ancestors) => {
            if (!types.has(node.name.value)) {
                return null; // delete node
            }
        },
        [Kind.UNION_TYPE_DEFINITION]: (node, key, parent, path, ancestors) => {
            if (!types.has(node.name.value)) {
                return null; // delete node
            }

            const ret: UnionTypeDefinitionNode = {
                ...node,
                types: node.types.filter(n => types.has(n.name.value))
            }
            return ret
        },
        [Kind.FIELD_DEFINITION]: (node, key, parent, path, ancestors) => {
            const realParent = ancestors[ancestors.length - 1];

            if (isTypeDefinitionNode(realParent)) {
                if (fieldsToKeep(realParent, f).map(f => f.name.value).indexOf(node.name.value) === -1) {
                    return null; // delete field
                }
            } else {
                throw new Error("Parent of field is not a TypeDefinitionNode")
            }

        }
    })
    return newAST;
}