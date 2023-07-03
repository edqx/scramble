import { CompilerError, ErrorCode } from "../error";
import { ErrorCollector } from "../errorCollector";
import { AccessorExpression, AssignmentExpression, Expression, ExpressionKind, FunctionCallExpression, KeywordExpression, NumberExpression, OperatorExpression, ParenthesisExpression, StringExpression, StructFieldsExpression } from "../expression";
import { ExistingTypes } from "./ExistingTypes";
import { ClassSymbol, MacroSymbol, ScopedSymbol } from "./symbols";
import { resolveSymbolType } from "./resolveSymbolType";
import { resolveTypeName } from "./resolveTypeName";
import { ClassInstanceType, PrimitiveType, ProcedureSignatureType, Type, UnresolvedType, VoidType } from "./types";

export function inferExpressionType(expression: Expression, expressionScope: ScopedSymbol|ClassSymbol, existingTypes: ExistingTypes, errorCollector: ErrorCollector): Type|UnresolvedType {
    if (expression instanceof NumberExpression) {
        return PrimitiveType.DEFINITIONS.number;
    } else if (expression instanceof StringExpression) {
        return PrimitiveType.DEFINITIONS.string;
    } else if (expression instanceof StructFieldsExpression) {
        if (!(expression.reference instanceof KeywordExpression))
            throw new Error("Instantiating sub-class not supported");

        const constructorType = resolveTypeName(expressionScope, expression.reference, existingTypes, errorCollector);
        if (constructorType instanceof UnresolvedType) return new UnresolvedType(expression, expressionScope);
        if (!(constructorType instanceof ClassInstanceType)) throw new Error("Can only instantiate classes");
    
        return constructorType;
    } else if (expression instanceof ParenthesisExpression) {
        const lastExpression = expression.expressions[expression.expressions.length - 1];
        if (lastExpression === undefined) return VoidType.DEFINITION;

        return inferExpressionType(lastExpression, expressionScope, existingTypes, errorCollector);
    } else if (expression instanceof AssignmentExpression) {
        return inferExpressionType(expression.value, expressionScope, existingTypes, errorCollector);
    } else if (expression instanceof FunctionCallExpression) {
        if (expression.reference instanceof KeywordExpression) {
            const functionSymbol = expressionScope.getIdentifierReference(expression.reference.keyword);
            if (functionSymbol instanceof MacroSymbol) {
                throw new Error("Macro support not implemneted");
            }
        }

        const procSignature = inferExpressionType(expression.reference, expressionScope, existingTypes, errorCollector);
        if (procSignature instanceof UnresolvedType) {
            return new UnresolvedType(expression, expressionScope);
        }
        if (!(procSignature instanceof ProcedureSignatureType))
            throw new Error("Bad function call");

        if (expression.args.length !== procSignature.params.length) {
            errorCollector.addError(
                new CompilerError(ErrorCode.BadFunctioncall)
                    .addError(expression.position, "Bad function call")
                    .addInfo(procSignature.functionSymbol?.expression.position, `Function signature '${procSignature.getName()}' expects ${procSignature.params.length} \
argument${procSignature.params.length === 1 ? "" : "s"} whereas only ${expression.args.length} ${expression.args.length === 1 ? "is" : "are"} provided`)
            );
            return procSignature.returnType;
        }

        for (let i = 0; i < expression.args.length; i++) {
            const inferredArgumentType = inferExpressionType(expression.args[i], expressionScope, existingTypes, errorCollector);
            const paramType = procSignature.params[i].type;
            if (paramType instanceof UnresolvedType) {
                return new UnresolvedType(expression, expressionScope);
            }
            if (!inferredArgumentType.isEquivalentTo(paramType)) {
                errorCollector.addError(
                    new CompilerError(ErrorCode.BadFunctioncall)
                        .addError(expression.position, "Bad function call")
                        .addInfo(expression.args[i].position, `Type of '${inferredArgumentType.getName()}' is not assignable to type '${procSignature.params[i].type.getName()}' \
in argument ${i + 1} for function signature '${procSignature.getName()}'`)
                );
            }
        }

        return procSignature.returnType;
    } else if (expression instanceof AccessorExpression) {
        const baseType = inferExpressionType(expression.base, expressionScope, existingTypes, errorCollector);
        if (baseType instanceof ClassInstanceType) {
            const field = baseType.fields.get(expression.property.keyword);
            
            const method = baseType.methods.get(expression.property.keyword);
            if (field === undefined && method === undefined) throw new Error(`Property ${expression.property.keyword} not found on type ${baseType.getName()}`);

            return field?.type || resolveSymbolType(method!.methodSymbol, existingTypes, errorCollector);
        } else if (baseType instanceof UnresolvedType) {
            return new UnresolvedType(expression, expressionScope);
        } else {
            throw new Error("Cannot access property on non-class instance");
        }
    } else if (expression instanceof KeywordExpression) {
        if (expression.keyword === "this") {
            if (!existingTypes.typeCache.has(expressionScope.parent as ClassSymbol)) {
                return new UnresolvedType(expression, expressionScope);
            }
            return existingTypes.typeCache.get(expressionScope.parent as ClassSymbol)!;
        }

        const referenceSymbol = expressionScope.getIdentifierReference(expression.keyword);
        if (referenceSymbol === undefined) {
            errorCollector.addError(
                new CompilerError(ErrorCode.IdentifierNotFound)
                    .addError(expression.position, "Identifier not found")
                    .addInfo(expression.position, `Are you missing a procedure or variable declaration for '${expression.keyword}'?`)
            );
            return VoidType.DEFINITION;
        }
        
        const existingType = existingTypes.typeCache.get(referenceSymbol);
        if (existingType !== undefined) return existingType;

        let parent: ScopedSymbol|ClassSymbol|undefined = expressionScope;
        while (parent !== undefined) {
            if (parent === referenceSymbol) {
                return new UnresolvedType(expression, expressionScope);
            }
            parent = parent.parent;
        }

        return resolveSymbolType(referenceSymbol, existingTypes, errorCollector);
    } else if (expression instanceof OperatorExpression) {
        const left = inferExpressionType(expression.left, expressionScope, existingTypes, errorCollector);
        const right = inferExpressionType(expression.right, expressionScope, existingTypes, errorCollector);
        if (left instanceof UnresolvedType) {
            return new UnresolvedType(expression, expressionScope);
        }
        if (right instanceof UnresolvedType) {
            return new UnresolvedType(expression, expressionScope);
        }
        if (!(left instanceof PrimitiveType) || !(right instanceof PrimitiveType)) {
            throw new Error(`Operator '${expression.operator}' cannot be applied to '${left.getName()}' and '${right.getName()}'`);
        }
        switch (expression.operator) {
        case "+":
            return left.type === "string" || right.type === "string"
                ? PrimitiveType.DEFINITIONS.string
                : PrimitiveType.DEFINITIONS.number;
        case "*":
        case "/":
        case "-":
            return PrimitiveType.DEFINITIONS.number;
        }
    }
    
    throw new Error(`Invalid expression '${ExpressionKind[expression.kind]}'`);
}