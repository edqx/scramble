import { ErrorCollector } from "../errorCollector";
import { ArrayReferenceExpression, KeywordExpression, NumberExpression, ProcDeclarationExpression } from "../expression";
import { ExistingTypes } from "./ExistingTypes";
import { ClassSymbol, FieldSymbol, ProcedureSymbol, ScopedSymbol, TypeAliasSymbol } from "./symbols";
import { getProcedureSignature } from "./resolveSymbolType";
import { ArrayType, ClassInstanceType, ClassInstanceTypeField, ClassInstanceTypeMethod, PrimitiveType, ProcedureSignatureType, ProcedureSignatureTypeParameter, Type, UnresolvedType, VoidType } from "./types";

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
    typeReferenceExpression: ArrayReferenceExpression|ProcDeclarationExpression|KeywordExpression,
    existingTypes: ExistingTypes,
    errorCollector: ErrorCollector
): Type|UnresolvedType {
    if (typeReferenceExpression instanceof ArrayReferenceExpression) {
        const resolved = resolveTypeName(scope, typeReferenceExpression.reference as KeywordExpression|ArrayReferenceExpression, existingTypes, errorCollector);
        if (resolved instanceof UnresolvedType) throw new Error("Cannot calculate size of self-reference");

        if (!(typeReferenceExpression.capacity instanceof NumberExpression) || isNaN(parseInt(typeReferenceExpression.capacity.unprocessedNumber)))
            throw new Error("Capacity must be a constant integer");

        return new ArrayType(resolved, typeReferenceExpression.capacity === undefined ? undefined : parseInt(typeReferenceExpression.capacity.unprocessedNumber));
    }

    if (typeReferenceExpression instanceof ProcDeclarationExpression) {
        if (!typeReferenceExpression.isTypeDeclaration())
            return VoidType.DEFINITION;

        const argTypes = typeReferenceExpression.parameters.map(param => {
            if (param.type !== undefined) {
                return new ProcedureSignatureTypeParameter(undefined, resolveTypeName(scope, param.type, existingTypes, errorCollector));
            }

            throw new Error("Param requires a type");
        });

        return new ProcedureSignatureType(undefined, argTypes, resolveTypeName(scope, typeReferenceExpression.returnType, existingTypes, errorCollector));
    }

    const primitiveType = PrimitiveType.DEFINITIONS[typeReferenceExpression.keyword];
    if (primitiveType !== undefined)
        return primitiveType;

    if (typeReferenceExpression.keyword === "void") return VoidType.DEFINITION;

    const typeSymbol = scope.getIdentifierReference(typeReferenceExpression.keyword);

    if (typeSymbol === undefined) throw new Error(`Invalid type reference '${typeReferenceExpression}'`);

    const existingType = existingTypes.typeCache.get(typeSymbol);
    if (existingType !== undefined) return existingType;
    
    let parent: ScopedSymbol|ClassSymbol|undefined = scope;
    while (parent !== undefined) {
        if (parent === typeSymbol) {
            return new UnresolvedType(typeReferenceExpression, scope);
        }
        parent = parent.parent;
    }

    if (typeSymbol instanceof TypeAliasSymbol) {
        return resolveTypeName(typeSymbol.parent!, typeSymbol.expression.type, existingTypes, errorCollector);
    } else if (typeSymbol instanceof ClassSymbol) {
        return getClassInstanceType(typeSymbol, existingTypes, errorCollector);
    }

    throw new Error(`Invalid type reference '${typeReferenceExpression}'`);
}