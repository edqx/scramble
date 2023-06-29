import { ErrorCollector } from "../errorCollector";
import { AccessorExpression, AssignmentExpression, ClassDeclarationExpression, Expression, FunctionCallExpression, IfStatementExpression, KeywordExpression, MacroDeclarationExpression, NumberExpression, OperatorExpression, ParameterDeclarationExpression, ParenthesisExpression, ProcDeclarationExpression, ReturnStatementExpression, StringExpression, StructFieldsExpression, TypeAliasDeclarationExpression, TypeGuardExpression, UnaryOperatorExpression, VariableDeclarationExpression, WhileStatementExpression } from "../expression";
import { ClassSymbol, CodeSymbol, MacroSymbol, ParameterSymbol, ProcedureSymbol, SymbolFlag, TypeAliasSymbol, VariableSymbol } from "./symbols";
import { SymbolDeclarationStore } from "./symbolDeclarationStore";

export function staticallyAnalyseExpressionDeclaration(
    parentScope: ProcedureSymbol|MacroSymbol,
    expression: Expression,
    symbols: SymbolDeclarationStore,
    errorCollector: ErrorCollector
) {
    if (expression instanceof ClassDeclarationExpression) {
        ClassSymbol.analyseDeclaration(parentScope, expression, symbols, errorCollector);
    } else if (expression instanceof TypeAliasDeclarationExpression && parentScope instanceof ProcedureSymbol) {
        TypeAliasSymbol.analyseDeclaration(parentScope, expression, symbols, errorCollector);
    } else if (expression instanceof MacroDeclarationExpression) {
        MacroSymbol.analyseDeclaration(parentScope, expression, symbols, errorCollector);
    } else if (expression instanceof ParameterDeclarationExpression && parentScope instanceof ProcedureSymbol) {
        ParameterSymbol.analyseDeclaration(parentScope, expression, symbols, errorCollector);
    } else if (expression instanceof VariableDeclarationExpression && parentScope instanceof ProcedureSymbol) {
        VariableSymbol.analyseDeclaration(parentScope, expression, symbols, errorCollector);
    } else if (expression instanceof ProcDeclarationExpression) {
        ProcedureSymbol.analyseDeclaration(parentScope, expression, symbols, errorCollector);
    }
}

export enum StaticAnalysisFlags {
    ThisReassigned = 1
}

export function staticallyAnalyseExpression(
    parentScope: ProcedureSymbol|MacroSymbol,
    scopeTraversal: Set<Expression>,
    expression: Expression,
    symbolTransformer: undefined|((symbol: CodeSymbol) => void),
    analysisFlags: number,
    symbols: SymbolDeclarationStore,
    errorCollector: ErrorCollector
) {
    if (expression instanceof AccessorExpression) {
        staticallyAnalyseExpression(parentScope, scopeTraversal, expression.base, symbolTransformer, analysisFlags, symbols, errorCollector);
    } else if (expression instanceof AssignmentExpression) {
        if (expression.reference instanceof KeywordExpression) {
            const reference = parentScope.getIdentifierReference(expression.reference.keyword);
            if (reference === undefined) throw new Error(`Could not find reference '${expression.reference.keyword}'`);
    
            if (!reference.flags.has(SymbolFlag.Hoisted) && !scopeTraversal.has(reference.expression))
                throw new Error(`Reference not declared '${expression.reference.keyword}'`);

            symbolTransformer?.(reference);

            if (reference instanceof ParameterSymbol) {
                reference.flags.add(SymbolFlag.ParamReassigned);
            }
        } else {
            staticallyAnalyseExpression(parentScope, scopeTraversal, expression.reference, symbol => {
                symbolTransformer?.(symbol);
                if (symbol instanceof ParameterSymbol) {
                    symbol.flags.add(SymbolFlag.ParamReassigned);
                }
            }, analysisFlags | StaticAnalysisFlags.ThisReassigned, symbols, errorCollector);
        }

        staticallyAnalyseExpression(parentScope, scopeTraversal, expression.value, symbolTransformer, analysisFlags, symbols, errorCollector);
    } else if (expression instanceof VariableDeclarationExpression) {
        const reference = parentScope.getIdentifierReference(expression.identifier);
        if (reference === undefined) throw new Error(`Could not find reference '${expression.identifier}'`);

        symbolTransformer?.(reference);

        if (reference instanceof ParameterSymbol) {
            reference.flags.add(SymbolFlag.ParamReassigned);
        }
        
        staticallyAnalyseExpression(parentScope, scopeTraversal, expression.initialValue, symbolTransformer, analysisFlags, symbols, errorCollector);
    } else if (expression instanceof ClassDeclarationExpression) {
        for (const method of expression.methods) {
            staticallyAnalyseExpression(parentScope, scopeTraversal, method, symbolTransformer, analysisFlags, symbols, errorCollector);
        }
    } else if (expression instanceof FunctionCallExpression) {
        if (expression.reference instanceof KeywordExpression) {
            const reference = parentScope.getIdentifierReference(expression.reference.keyword);
            if (reference === undefined) throw new Error(`Could not find reference '${expression.reference.keyword}'`);
    
            if (!reference.flags.has(SymbolFlag.Hoisted) && !scopeTraversal.has(reference.expression))
                throw new Error(`Reference not declared '${expression.reference.keyword}'`);

            symbolTransformer?.(reference);
        } else {
            staticallyAnalyseExpression(parentScope, scopeTraversal, expression.reference, symbolTransformer, analysisFlags, symbols, errorCollector);
        }
        for (const arg of expression.args) {
            staticallyAnalyseExpression(parentScope, scopeTraversal, arg, symbolTransformer, analysisFlags, symbols, errorCollector);
        }
    } else if (expression instanceof IfStatementExpression) {
        staticallyAnalyseExpression(parentScope, scopeTraversal, expression.condition, symbolTransformer, analysisFlags, symbols, errorCollector);
        staticallyAnalyseExpression(parentScope, scopeTraversal, expression.block, symbolTransformer, analysisFlags, symbols, errorCollector);
        if (expression.elseBlock !== undefined) {
            staticallyAnalyseExpression(parentScope, scopeTraversal, expression.elseBlock, symbolTransformer, analysisFlags, symbols, errorCollector);
        }
    } else if (expression instanceof KeywordExpression) {
        if (expression.keyword === "this") {
            if (!(parentScope.parent instanceof ClassSymbol)) throw new Error("Cannot use 'this' in non-class");
            if ((analysisFlags & StaticAnalysisFlags.ThisReassigned) !== 0) {
                parentScope.flags.add(SymbolFlag.MethodThisReassigned);
            }
            return;
        }

        const reference = parentScope.getIdentifierReference(expression.keyword);
        if (reference === undefined) throw new Error(`Could not find reference '${expression.keyword}'`);

        if (!reference.flags.has(SymbolFlag.Hoisted) && !scopeTraversal.has(reference.expression))
            throw new Error(`Reference not declared '${expression.keyword}'`);

        if (reference instanceof ProcedureSymbol) {
            reference.flags.add(SymbolFlag.ProcUsedAsValue);
        }
    } else if (expression instanceof MacroDeclarationExpression) {
        for (const param of expression.parameters) {
            staticallyAnalyseExpression(parentScope, scopeTraversal, param, symbolTransformer, analysisFlags, symbols, errorCollector);
        }
        const macroDeclaration = symbols.getSymbol(expression);
        if (macroDeclaration === undefined || !(macroDeclaration instanceof MacroSymbol)) throw new Error("??");
        symbolTransformer?.(macroDeclaration);
        staticallyAnalyseExpression(macroDeclaration, scopeTraversal, expression.block, symbolTransformer, analysisFlags, symbols, errorCollector);
    } else if (expression instanceof NumberExpression) {
        // no-op
    } else if (expression instanceof OperatorExpression) {
        staticallyAnalyseExpression(parentScope, scopeTraversal, expression.left, symbolTransformer, analysisFlags, symbols, errorCollector);
        staticallyAnalyseExpression(parentScope, scopeTraversal, expression.right, symbolTransformer, analysisFlags, symbols, errorCollector);
    } else if (expression instanceof ParameterDeclarationExpression) {
        // todo: validate type
        if (expression.defaultValue !== undefined) {
            staticallyAnalyseExpression(parentScope, scopeTraversal, expression.defaultValue, symbolTransformer, analysisFlags, symbols, errorCollector);
        }
    } else if (expression instanceof ParenthesisExpression) {
        staticallyAnalyseBlock(parentScope, scopeTraversal, expression.expressions, symbolTransformer, analysisFlags, symbols, errorCollector);
    } else if (expression instanceof ProcDeclarationExpression) {
        if (expression.isCodeDefinition()) {
            for (const param of expression.parameters) {
                staticallyAnalyseExpression(parentScope, scopeTraversal, param, symbolTransformer, analysisFlags, symbols, errorCollector);
            }
            const procDeclaration = symbols.getSymbol(expression);
            scopeTraversal.add(expression);
            if (procDeclaration === undefined || !(procDeclaration instanceof ProcedureSymbol)) throw new Error("??");
            symbolTransformer?.(procDeclaration);
            staticallyAnalyseExpression(procDeclaration, scopeTraversal, expression.block, symbolTransformer, analysisFlags, symbols, errorCollector);
            return; // expression added to scope traversal
        }
    } else if (expression instanceof ReturnStatementExpression) {
        if (expression.expression !== undefined) {
            staticallyAnalyseExpression(parentScope, scopeTraversal, expression.expression, symbolTransformer, analysisFlags, symbols, errorCollector);
        }
    } else if (expression instanceof StringExpression) {
        // no-op
    } else if (expression instanceof StructFieldsExpression) {
        for (const assignment of expression.assignments) {
            staticallyAnalyseExpression(parentScope, scopeTraversal, assignment.value, symbolTransformer, analysisFlags, symbols, errorCollector);
        }
        // todo: check fields
    } else if (expression instanceof TypeGuardExpression) {
        // todo: check reference & type
    } else if (expression instanceof UnaryOperatorExpression) {
        staticallyAnalyseExpression(parentScope, scopeTraversal, expression.expression, symbolTransformer, analysisFlags, symbols, errorCollector);
    } else if (expression instanceof WhileStatementExpression) {
        staticallyAnalyseExpression(parentScope, scopeTraversal, expression.condition, symbolTransformer, analysisFlags, symbols, errorCollector);
        staticallyAnalyseExpression(parentScope, scopeTraversal, expression.block, symbolTransformer, analysisFlags, symbols, errorCollector);
    }
    scopeTraversal.add(expression);
}

export function staticallyAnalyseBlock(
    parentScope: ProcedureSymbol|MacroSymbol,
    scopeTraversal: Set<Expression>,
    block: Expression[],
    symbolTransformer: undefined|((symbol: CodeSymbol) => void),
    analysisFlags: number,
    symbols: SymbolDeclarationStore,
    errorCollector: ErrorCollector
) {
    for (const expression of block) {
        staticallyAnalyseExpression(parentScope, scopeTraversal, expression, symbolTransformer, analysisFlags, symbols, errorCollector);
    }
}