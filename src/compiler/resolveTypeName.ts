import { ErrorCollector } from "../errorCollector";
import { KeywordExpression, ProcDeclarationExpression } from "../expression";
import { ExistingTypes } from "./ExistingTypes";
import { ClassSymbol, FieldSymbol, ProcedureSymbol, ScopedSymbol, TypeAliasSymbol } from "./symbols";
import { getProcedureSignature } from "./resolveSymbolType";
import { ClassInstanceType, ClassInstanceTypeField, ClassInstanceTypeMethod, PrimitiveType, ProcedureSignatureType, ProcedureSignatureTypeParameter, Type, UnresolvedType, VoidType } from "./types";

export function getClassInstanceType(typeSymbol: ClassSymbol, existingTypes: ExistingTypes, errorCollector: ErrorCollector): ClassInstanceType {
    const existingType = existingTypes.typeCache.get(typeSymbol);
    if (existingType !== undefined) return existingType as ClassInstanceType;
    let offset = 0;
    const fields: Map<string, ClassInstanceTypeField> = new Map;
    const methods: Map<string, ClassInstanceTypeMethod> = new Map;
    for (const [, child ] of typeSymbol.children) {
        if (child instanceof FieldSymbol) {
            const fieldType = resolveTypeName(typeSymbol, child.expression.type, existingTypes, errorCollector);
            const field = new ClassInstanceTypeField(offset, child, fieldType);
            fields.set(child.name, field);
            if (field.type instanceof UnresolvedType) throw new Error("Assertion failed; cannot calculate size of unresolved type");
            offset += field.type.getSize();
        } else if (child instanceof ProcedureSymbol) {
            const method = new ClassInstanceTypeMethod(child, getProcedureSignature(child, existingTypes, errorCollector));
            methods.set(child.name, method);
        }
    }
    return existingTypes.getOrCreateTypeForSymbol(typeSymbol, new ClassInstanceType(typeSymbol, fields, methods));
}

export function resolveTypeName(
    scope: ScopedSymbol|ClassSymbol,
    type: ProcDeclarationExpression|KeywordExpression,
    existingTypes: ExistingTypes,
    errorCollector: ErrorCollector
): Type|UnresolvedType {
    if (type instanceof ProcDeclarationExpression) {
        if (!type.isTypeDeclaration())
            return VoidType.DEFINITION;

        const argTypes = type.parameters.map(param => {
            if (param.type !== undefined) {
                return new ProcedureSignatureTypeParameter(undefined, resolveTypeName(scope, param.type, existingTypes, errorCollector));
            }

            throw new Error("Param requires a type");
        });

        return new ProcedureSignatureType(undefined, argTypes, resolveTypeName(scope, type.returnType, existingTypes, errorCollector));
    }

    const primitiveType = PrimitiveType.DEFINITIONS[type.keyword];
    if (primitiveType !== undefined)
        return primitiveType;

    if (type.keyword === "void") return VoidType.DEFINITION;

    const typeSymbol = scope.getIdentifierReference(type.keyword);

    if (typeSymbol === undefined) throw new Error(`Invalid type reference '${type}'`);

    const existingType = existingTypes.typeCache.get(typeSymbol);
    if (existingType !== undefined) return existingType;
    
    let parent: ScopedSymbol|ClassSymbol|undefined = scope;
    while (parent !== undefined) {
        if (parent === typeSymbol) {
            return new UnresolvedType(type, scope);
        }
        parent = parent.parent;
    }

    if (typeSymbol instanceof TypeAliasSymbol) {
        return resolveTypeName(typeSymbol.parent!, typeSymbol.expression.type, existingTypes, errorCollector);
    } else if (typeSymbol instanceof ClassSymbol) {
        return getClassInstanceType(typeSymbol, existingTypes, errorCollector);
    }

    throw new Error(`Invalid type reference '${type}'`);
}