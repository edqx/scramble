import { ErrorCollector } from "../errorCollector";
import { Expression, ParenthesisExpression, ReturnStatementExpression, IfStatementExpression, WhileStatementExpression, ScriptExpression, KeywordExpression, AccessorExpression } from "../expression";
import { ExistingTypes } from "./ExistingTypes";
import { ProcedureSymbol, ParameterSymbol, CodeSymbol, FieldSymbol, ScopedSymbol, VariableSymbol, ClassSymbol } from "./symbols";
import { inferExpressionType } from "./inferExpressionType";
import { getClassInstanceType, resolveTypeName } from "./resolveTypeName";
import { Type, VoidType, ProcedureSignatureType, ProcedureSignatureTypeParameter, ClassInstanceType, PrimitiveType, UnresolvedType } from "./types";

export function getPotentialReturnTypes(block: Expression, blockScope: ProcedureSymbol, existingTypes: ExistingTypes, errorCollector: ErrorCollector): (Type|UnresolvedType)[] {
    if (block instanceof ParenthesisExpression) {
        const types: (Type|UnresolvedType)[] = [];
        for (const expression of block.expressions) {
            if (expression instanceof ReturnStatementExpression) {
                if (expression.expression !== undefined) {
                    types.push(inferExpressionType(expression.expression, blockScope, existingTypes, errorCollector));
                } else {
                    types.push(VoidType.DEFINITION);
                }
                break;
            } else if (expression instanceof IfStatementExpression) {
                types.push(...getPotentialReturnTypes(expression.block, blockScope, existingTypes, errorCollector));
                if (expression.elseBlock !== undefined)
                    types.push(...getPotentialReturnTypes(expression.elseBlock, blockScope, existingTypes, errorCollector));
            } else if (expression instanceof WhileStatementExpression) {
                types.push(...getPotentialReturnTypes(expression.block, blockScope, existingTypes, errorCollector));
            }
        }
        return types.length > 0 ? types : [ VoidType.DEFINITION ];
    } else if (block instanceof ReturnStatementExpression) {
        if (block.expression !== undefined) {
            return [ inferExpressionType(block.expression, blockScope, existingTypes, errorCollector) ];
        }

        return [ VoidType.DEFINITION ];
    }

    return [ VoidType.DEFINITION ];
}

export function getProcedureSignature(symbol: ProcedureSymbol, existingTypes: ExistingTypes, errorCollector: ErrorCollector) {
    if (symbol.expression instanceof ScriptExpression)
        return new ProcedureSignatureType(undefined, [], VoidType.DEFINITION);

    const existingType = existingTypes.typeCache.get(symbol);
    if (existingType !== undefined) return existingType as ProcedureSignatureType;

    const argTypes = symbol.expression.parameters.map(param => {
        if (param.type !== undefined) {
            return new ProcedureSignatureTypeParameter(
                symbol.symbols.get(param.identifier)! as ParameterSymbol,
                resolveTypeName(symbol.parent!, param.type, existingTypes, errorCollector)
            );
        }

        if (param.defaultValue !== undefined) {
            const paramType = inferExpressionType(param.defaultValue, symbol, existingTypes, errorCollector);
            return new ProcedureSignatureTypeParameter(
                symbol.symbols.get(param.identifier)! as ParameterSymbol,
                resolveThisType(paramType, existingTypes, errorCollector)
            );
        }
        
        throw new Error("Param requires a type");
    });

    if (symbol.expression.returnType !== undefined) {
        return new ProcedureSignatureType(
            symbol,
            argTypes,
            resolveTypeName(symbol.parent!, symbol.expression.returnType, existingTypes, errorCollector)
        );
    }

    if (symbol.expression.block === undefined) throw new Error("Procedure type declaration must have a return type specified");

    const possibleInferredReturnTypes = getPotentialReturnTypes(symbol.expression.block, symbol, existingTypes, errorCollector);
    if (new Set(possibleInferredReturnTypes).size > 1)
        throw new Error("Function cannot have multiple return types");

    return new ProcedureSignatureType(symbol, argTypes, possibleInferredReturnTypes[0]);
}

export function resolveSymbolType(symbol: CodeSymbol, existingTypes: ExistingTypes, errorCollector: ErrorCollector): Type|UnresolvedType {
    const existingType = existingTypes.typeCache.get(symbol);
    if (existingType !== undefined) return existingType;

    if (symbol instanceof FieldSymbol) {
        return resolveTypeName(symbol.parent as ScopedSymbol, symbol.expression.type, existingTypes, errorCollector)
    } else if (symbol instanceof ParameterSymbol) {
        if (symbol.expression.type !== undefined) {
            return resolveTypeName(symbol.parent as ScopedSymbol, symbol.expression.type, existingTypes, errorCollector);
        }

        if (symbol.expression.defaultValue !== undefined) {
            return inferExpressionType(
                symbol.expression.defaultValue,
                symbol.parent as ScopedSymbol /* not a class if it's a parameter */,
                existingTypes,
                errorCollector
            );
        }

        throw new Error("Failed to resolve parameter type");
    } else if (symbol instanceof ProcedureSymbol) {
        return getProcedureSignature(symbol, existingTypes, errorCollector);
    } else if (symbol instanceof VariableSymbol) {
        if (symbol.expression.type !== undefined) {
            return resolveTypeName(symbol.parent as ScopedSymbol, symbol.expression.type, existingTypes, errorCollector);
        }

        const t = inferExpressionType(
            symbol.expression.initialValue,
            symbol.parent as ScopedSymbol /* not a class if it's a variable */,
            existingTypes,
            errorCollector);
        console.log(symbol.name, symbol.expression.initialValue, t);
        return t;
    }

    return VoidType.DEFINITION;
}

export function resolveThisType(type: Type|UnresolvedType, existingTypes: ExistingTypes, errorCollector: ErrorCollector): Type {
    if (type instanceof UnresolvedType) {
        const unresolvedType = inferExpressionType(type.expression, type.scope, existingTypes, errorCollector);
        return resolveThisType(unresolvedType, existingTypes, errorCollector);
    } else if (type instanceof Type) {
        return type;
    }

    throw new Error("Invalid type to resolve 'this' for");
}