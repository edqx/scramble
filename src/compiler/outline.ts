import { ErrorCollector } from "../errorCollector";
import { AccessorExpression, AssignmentExpression, Expression, FunctionCallExpression, KeywordExpression, NumberExpression, ParenthesisExpression, ProcDeclarationExpression, StringExpression, StructFieldsExpression, VariableDeclarationExpression } from "../expression";
import { ClassSymbol, CodeSymbol, ProcedureSymbol, ScopedSymbol } from "./definitions";
import { SymbolDeclarationStore } from "./symbolDeclarationStore";

export function inferType(expression: Expression, currentScope: ScopedSymbol): string|CodeSymbol|undefined {
    if (expression instanceof NumberExpression) {
        return "number";
    } else if (expression instanceof StringExpression) {
        return "string";
    } else if (expression instanceof StructFieldsExpression) {
        return inferType(expression.reference, currentScope);
    } else if (expression instanceof ParenthesisExpression) {
        const lastExpression = expression.expressions[expression.expressions.length - 1];
        if (lastExpression === undefined) throw new Error("Failed to resolve type");

        return inferType(lastExpression, currentScope);
    } else if (expression instanceof AssignmentExpression) {
        return inferType(expression.value, currentScope);
    } else if (expression instanceof FunctionCallExpression) {
        const procSymbol = inferType(expression.reference, currentScope);
        if (!(procSymbol instanceof ProcedureSymbol) || !(procSymbol.expression instanceof ProcDeclarationExpression))
            throw new Error("Bad call");

        const returnType = procSymbol.expression.returnType;
        if (!(returnType instanceof KeywordExpression))
            throw new Error("Bad return type");

        return procSymbol.parent?.getIdentifierReference(returnType.keyword);
    } else if (expression instanceof AccessorExpression) {
        const baseType = inferType(expression.base, currentScope);
        if (typeof baseType === "string") {
            return undefined; // todo: built-in types
        } else if (baseType instanceof CodeSymbol) {
            if (baseType instanceof ClassSymbol) {
                return baseType.children.get(expression.property.keyword);
            } else {
                throw new Error("Bad access");
            }
        } else {
            return undefined;
        }
    } else if (expression instanceof KeywordExpression) {
        return currentScope.getIdentifierReference(expression.keyword);
    }
}

export function createProjectOutline(block: Expression[], scope: ScopedSymbol, symbols: SymbolDeclarationStore, errors: ErrorCollector) {
    for (const expression of block) {
        if (expression instanceof VariableDeclarationExpression) {
            console.log(inferType(expression.initialValue, scope));
        }
    }
}