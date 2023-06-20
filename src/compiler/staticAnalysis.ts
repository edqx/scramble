import { CompilerError, ErrorCode } from "../error";
import { ErrorCollector } from "../errorCollector";
import { Expression, FunctionCallExpression, KeywordExpression, ProcDeclarationExpression, VariableDeclarationExpression, ParenthesisExpression, OperatorExpression, AccessorExpression, AssignmentExpression, ParameterDeclarationExpression, ReturnStatementExpression, TypeGuardExpression, UnaryOperatorExpression, IfStatementExpression, WhileStatementExpression } from "../expression";
import { SymbolDeclarationStore } from "./symbolDeclarationStore";
import { ProcedureSymbol, SymbolFlag, VariableSymbol } from "./symbols";

function readProcDeclaration(
    scope: ProcedureSymbol,
    scopeTraversal: Set<Expression>,
    procDeclarationExpression: ProcDeclarationExpression,
    symbols: SymbolDeclarationStore,
    errorCollector: ErrorCollector
) {
    const procDeclarationSymbol = scope.symbols.get(procDeclarationExpression.identifier);
    if (procDeclarationSymbol === undefined || !(procDeclarationSymbol instanceof ProcedureSymbol)) throw new Error("??");

    for (const parameter of procDeclarationExpression.parameters) {
        staticallyAnalyseExpression(procDeclarationSymbol, scopeTraversal, parameter, symbols, errorCollector);
    }
    scopeTraversal.add(procDeclarationExpression);
    staticallyAnalyseExpression(procDeclarationSymbol, scopeTraversal, procDeclarationExpression.block, symbols, errorCollector);
}

function readVariableDeclaration(
    scope: ProcedureSymbol,
    scopeTraversal: Set<Expression>,
    varDeclarationExpression: VariableDeclarationExpression,
    symbols: SymbolDeclarationStore,
    errorCollector: ErrorCollector
) {
    const varDeclarationSymbol = scope.symbols.get(varDeclarationExpression.identifier);
    if (varDeclarationSymbol === undefined || !(varDeclarationSymbol instanceof VariableSymbol)) throw new Error("??");

    if (varDeclarationExpression.varType === "let") {
        varDeclarationSymbol.flags.add(SymbolFlag.VariableAllocatedOnHeap);
    }

    // todo: validate types

    staticallyAnalyseExpression(scope, scopeTraversal, varDeclarationExpression.initialValue, symbols, errorCollector);
}

function readParameterDeclaration(
    scope: ProcedureSymbol,
    scopeTraversal: Set<Expression>,
    parameterDeclarationExpression: ParameterDeclarationExpression,
    symbols: SymbolDeclarationStore,
    errorCollector: ErrorCollector
) {
    if (parameterDeclarationExpression.defaultValue !== undefined) {
        staticallyAnalyseExpression(scope, new Set([...scopeTraversal]), parameterDeclarationExpression.defaultValue, symbols, errorCollector);
    }

    // todo: validate types

    const paramVariable = symbols.addVariable(parameterDeclarationExpression, scope, parameterDeclarationExpression.identifier);
    paramVariable.flags.add(SymbolFlag.VariableIsParam);
}

function readDeclarationExpression(scope: ProcedureSymbol, expression: Expression, symbols: SymbolDeclarationStore, errorCollector: ErrorCollector) {
    if (expression instanceof ProcDeclarationExpression) {
        const existingRef = scope.symbols.get(expression.identifier);
        if (existingRef) {
            errorCollector.addError(
                new CompilerError(ErrorCode.IdentifierInUse)
                    .addError(expression.position, "Identifier in use")
                    .addInfo(existingRef.declaredAt.position, `'${existingRef.name}' has already been declared in this scope`)
            );
            return;
        }
        symbols.addProcedure(expression, scope, expression.identifier);
    } else if (expression instanceof VariableDeclarationExpression) {
        const existingRef = scope.symbols.get(expression.identifier);
        if (existingRef) {
            errorCollector.addError(
                new CompilerError(ErrorCode.IdentifierInUse)
                    .addError(expression.position, "Identifier in use")
                    .addInfo(existingRef.declaredAt.position, `'${existingRef.name}' has already been declared in this scope`)
            );
            return;
        }
        symbols.addVariable(expression, scope, expression.identifier);
    }
}

// todo: function hoisting
export function staticallyAnalyseExpression(
    scope: ProcedureSymbol,
    scopeTraversal: Set<Expression>,
    expression: Expression,
    symbols: SymbolDeclarationStore,
    errorCollector: ErrorCollector
) {
    if (expression instanceof ProcDeclarationExpression) {
        readProcDeclaration(scope, scopeTraversal, expression, symbols, errorCollector);
    } else {
        if (expression instanceof KeywordExpression) {
            const symbol = scope.getIdentifierReference(expression.keyword);
            if (symbol === undefined) {
                errorCollector.addError(
                    new CompilerError(ErrorCode.IdentifierNotFound)
                        .addError(expression.position, "Identifier not found")
                        .addInfo(undefined, `Identifier '${expression.keyword} is not found in this scope`)
                );
                return;
            }
            if (!symbol.flags.has(SymbolFlag.Hoisted) && !scopeTraversal.has(symbol.declaredAt) && symbol.parent === scope /* Assume vars on parent are initialised */) {
                errorCollector.addError(
                    new CompilerError(ErrorCode.IdentifierNotFound)
                        .addError(expression.position, "Use of identifier before declaration")
                        .addInfo(symbol.declaredAt.position, `'${symbol.name}' is declared here`)
                );
                return;
            }
            if (symbol instanceof ProcedureSymbol) {
                symbol.flags.add(SymbolFlag.ProcUsedAsValue);
            }
        } else if (expression instanceof VariableDeclarationExpression) {
            readVariableDeclaration(scope, scopeTraversal, expression, symbols, errorCollector);
        } else if (expression instanceof FunctionCallExpression) {
            const symbol = scope.getIdentifierReference(expression.identifier);
            if (symbol === undefined) {
                errorCollector.addError(
                    new CompilerError(ErrorCode.IdentifierNotFound)
                        .addError(expression.position, "Identifier not found")
                        .addInfo(undefined, `Identifier '${expression.identifier} is not found in this scope`)
                );
                return;
            }
            let parent: ProcedureSymbol|undefined = scope;
            while (parent !== undefined) {
                if (symbol === parent) {
                    symbol.flags.add(SymbolFlag.ProcUsedRecursively);
                    break;
                }
                parent = parent.parent;
            }
            for (const arg of expression.args) {
                staticallyAnalyseExpression(scope, scopeTraversal, arg, symbols, errorCollector);
            }
        } else if (expression instanceof ParenthesisExpression) {
            const subTraversal = new Set(scopeTraversal);
            staticallyAnalyseBlock(scope, subTraversal, expression.expressions, symbols, errorCollector);
        } else if (expression instanceof OperatorExpression) {
            staticallyAnalyseExpression(scope, scopeTraversal, expression.left, symbols, errorCollector);
            staticallyAnalyseExpression(scope, scopeTraversal, expression.right, symbols, errorCollector);
        } else if (expression instanceof AccessorExpression) {
            staticallyAnalyseExpression(scope, scopeTraversal, expression.base, symbols, errorCollector);
            // TODO: objects
        } else if (expression instanceof AssignmentExpression) {
            if (expression.reference instanceof KeywordExpression) {
                const symbol = scope.getIdentifierReference(expression.reference.keyword);
                if (symbol === undefined) {
                    errorCollector.addError(
                        new CompilerError(ErrorCode.IdentifierNotFound)
                            .addError(expression.position, "Identifier not found")
                            .addInfo(undefined, `Identifier '${expression.reference.keyword} is not found in this scope`)
                    );
                    return;
                }
                if (symbol.flags.has(SymbolFlag.VariableIsParam)) {
                    symbol.flags.add(SymbolFlag.ParamReassigned);
                }
            }

            staticallyAnalyseExpression(scope, scopeTraversal, expression.reference, symbols, errorCollector);
            staticallyAnalyseExpression(scope, scopeTraversal, expression.value, symbols, errorCollector);
        } else if (expression instanceof ParameterDeclarationExpression) {
            readParameterDeclaration(scope, scopeTraversal, expression, symbols, errorCollector);
        } else if (expression instanceof ReturnStatementExpression) {
            if (expression.expression !== undefined) staticallyAnalyseExpression(scope, scopeTraversal, expression.expression, symbols, errorCollector);
        } else if (expression instanceof TypeGuardExpression) {
            // todo: validate types
        } else if (expression instanceof UnaryOperatorExpression) {
            staticallyAnalyseExpression(scope, scopeTraversal, expression.expression, symbols, errorCollector);
        } else if (expression instanceof IfStatementExpression) {
            staticallyAnalyseExpression(scope, scopeTraversal, expression.condition, symbols, errorCollector);
            staticallyAnalyseExpression(scope, scopeTraversal, expression.block, symbols, errorCollector);
            if (expression.elseBlock !== undefined) {
                staticallyAnalyseExpression(scope, scopeTraversal, expression.elseBlock, symbols, errorCollector);
            }
        } else if (expression instanceof WhileStatementExpression) {
            staticallyAnalyseExpression(scope, scopeTraversal, expression.condition, symbols, errorCollector);
            staticallyAnalyseExpression(scope, scopeTraversal, expression.block, symbols, errorCollector);
        }
        scopeTraversal.add(expression);
    }
}

export function staticallyAnalyseBlock(
    scope: ProcedureSymbol,
    scopeTraversal: Set<Expression>,
    expressions: Expression[],
    symbols: SymbolDeclarationStore,
    errorCollector: ErrorCollector
) {
    for (const expression of expressions) { // first pass
        readDeclarationExpression(scope, expression, symbols, errorCollector);
    }
    for (const expression of expressions) {
        staticallyAnalyseExpression(scope, scopeTraversal, expression, symbols, errorCollector);
    }
}