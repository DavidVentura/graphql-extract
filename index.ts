import {
    Kind, parse, visit, TypeNode,
    ObjectTypeDefinitionNode, FieldDefinitionNode,
    isTypeDefinitionNode, DocumentNode, NamedTypeNode, UnionTypeDefinitionNode, ASTNode, InputObjectTypeDefinitionNode, InputValueDefinitionNode
} from "graphql";
/**
 * The keys on this object are _types_, on which fields (or union members) can be included/excluded.
 */
export type Filter = {
    [type: string]: {
        include?: string[];
        exclude?: string[];
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

// copy-pasting the same function 3 times is sad, but better than TS generics

const fieldsToKeep = (n: ObjectTypeDefinitionNode, typename: string, filter: Filter): readonly FieldDefinitionNode[] => {
    const f = filter[typename];
    if (f === undefined) { // no rules for type; keep all
        return n.fields || [];
    }

    const fields = n.fields || [];
    fields.filter((a: FieldDefinitionNode | InputValueDefinitionNode) => true)
    const allFieldNames = (n.fields || []).map(field => field.name.value);
    const toKeep = (n.fields || []).filter(field => (f.include || allFieldNames).includes(field.name.value));
    return toKeep.filter(field => !(f.exclude || []).includes(field.name.value));
};

const inputFieldsToKeep = (n: InputObjectTypeDefinitionNode, typename: string, filter: Filter): readonly InputValueDefinitionNode[] => {
    const f = filter[typename];
    if (f === undefined) { // no rules for type; keep all
        return n.fields || [];
    }

    const fields = n.fields || [];
    fields.filter((a: FieldDefinitionNode | InputValueDefinitionNode) => true)
    const allFieldNames = (n.fields || []).map(field => field.name.value);
    const toKeep = (n.fields || []).filter(field => (f.include || allFieldNames).includes(field.name.value));
    return toKeep.filter(field => !(f.exclude || []).includes(field.name.value));
};
const unionMembersToKeep = (n: UnionTypeDefinitionNode, filter: Filter): readonly NamedTypeNode[] => {
    const f = filter[n.name.value];
    if (f === undefined) { // no rules for type; keep all
        return n.types || [];
    }

    const allFieldNames = (n.types || []).map(field => field.name.value);
    const toKeep = (n.types || []).filter(field => (f.include || allFieldNames).includes(field.name.value));
    return toKeep.filter(field => !(f.exclude || []).includes(field.name.value));
};

export const neededTypes = (ast: DocumentNode, filter: Filter): { flattened: Set<string>, tree: { [key: string]: string[] } } => {
    const neededTypes = new Set(Object.keys(filter));
    let changed = true;
    const deps: { [key: string]: string[] } = {};

    Object.keys(filter).forEach(k => deps[k] = []);
    while (changed) {
        changed = false;
        visit(ast, {
            [Kind.OBJECT_TYPE_DEFINITION]: (node) => {
                if (!neededTypes.has(node.name.value)) {
                    return AST.skipNode;
                }
                const toKeep = fieldsToKeep(node, node.name.value, filter);
                const fieldTypes = toKeep.map(f => typeNameFromTypeNode(f.type));

                const toAdd = fieldTypes.filter(el => !neededTypes.has(el));
                if (toAdd.length > 0) {
                    changed = true;
                    toAdd.forEach(el => neededTypes.add(el));
                    deps[node.name.value] = (deps[node.name.value] || []).concat(fieldTypes)
                    toKeep.forEach(f => {
                        f.arguments.forEach(arg => {
                            const typename = typeNameFromTypeNode(arg.type);
                            neededTypes.add(typename)
                            deps[node.name.value].push(typename);
                        })
                    })
                }
            },
            [Kind.UNION_TYPE_DEFINITION]: (node) => {
                if (!neededTypes.has(node.name.value)) {
                    return AST.skipNode;
                }
                const fieldTypes = unionMembersToKeep(node, filter).map(f => f.name.value)
                const toAdd = fieldTypes.filter(el => !neededTypes.has(el));
                if (toAdd.length > 0) {
                    changed = true;
                    toAdd.forEach(el => {
                        neededTypes.add(el)
                        deps[node.name.value] = (deps[node.name.value] || []).concat([el]);
                    });
                }
            },
            [Kind.INPUT_OBJECT_TYPE_DEFINITION]: (node) => {
                if (!neededTypes.has(node.name.value)) {
                    return AST.skipNode;
                }
                const fieldTypes = inputFieldsToKeep(node, node.name.value, filter).map(f => typeNameFromTypeNode(f.type));
                const toAdd = fieldTypes.filter(el => !neededTypes.has(el));
                if (toAdd.length > 0) {
                    changed = true;
                    toAdd.forEach(el => {
                        neededTypes.add(el)
                        deps[node.name.value] = (deps[node.name.value] || []).concat([el]);
                    });
                }
            }
        });
    }

    // dedup
    Object.keys(deps).forEach(k => deps[k] = [...new Set(deps[k])]);
    return {
        flattened: neededTypes,
        tree: deps
    };
}

// The `visit` function has very specific meaning for return types,
// these aliases make it more explicit
const AST = {
    deleteNode: null,
    replace: (x: ASTNode) => x,
    skipNode: undefined,

}
export const pruneSchema = (data: string, f: Filter): DocumentNode => {
    const ast = parse(data);
    const nt = neededTypes(ast, f);
    const types = [...nt.flattened].sort();
    const newAST = visit(ast, {
        [Kind.OBJECT_TYPE_DEFINITION]: (node) => {
            if (!types.includes(node.name.value)) {
                return AST.deleteNode;
            }
        },
        [Kind.ENUM_TYPE_DEFINITION]: (node) => {
            if (!types.includes(node.name.value)) {
                return AST.deleteNode;
            }
        },
        [Kind.INPUT_OBJECT_TYPE_DEFINITION]: (node) => {
            if (!types.includes(node.name.value)) {
                return AST.deleteNode;
            }
        },
        [Kind.INTERFACE_TYPE_DEFINITION]: (node) => {
            if (!types.includes(node.name.value)) {
                return AST.deleteNode;
            }
        },
        [Kind.UNION_TYPE_DEFINITION]: (node) => {
            if (!types.includes(node.name.value)) {
                return AST.deleteNode;
            }

            const ret: UnionTypeDefinitionNode = {
                ...node,
                types: node.types.filter(n => types.includes(n.name.value))
            }
            return AST.replace(ret)
        },
        [Kind.FIELD_DEFINITION]: (node, key, parent, path, ancestors) => {
            const realParent = ancestors[ancestors.length - 1];
            if ("kind" in realParent) {
                if (realParent.kind == Kind.OBJECT_TYPE_DEFINITION) {
                    const toKeep = fieldsToKeep(realParent, realParent.name.value, f);
                    if (toKeep.map(f => f.name.value).indexOf(node.name.value) === -1) {
                        return AST.deleteNode;
                    }
                } else {
                    throw new Error("Parent of field is not a TypeDefinitionNode")
                }
            } else {
                throw new Error("Parent of field is a list")
            }

        }
    })
    return newAST;
}