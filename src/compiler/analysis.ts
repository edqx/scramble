import { ErrorCollector } from "../errorCollector";
import { AccessorExpression, AssignmentExpression, ClassDeclarationExpression, Expression, FunctionCallExpression, IfStatementExpression, KeywordExpression, MacroDeclarationExpression, NumberExpression, OperatorExpression, ParameterDeclarationExpression, ParenthesisExpression, ProcDeclarationExpression, ReturnStatementExpression, StringExpression, StructFieldsExpression, TypeGuardExpression, UnaryOperatorExpression, VariableDeclarationExpression, WhileStatementExpression } from "../expression";
import { ClassSymbol, MacroSymbol, ParameterSymbol, ProcedureSymbol, SymbolFlag, VariableSymbol } from "./definitions";
import { SymbolDeclarationStore } from "./symbolDeclarationStore";

export function staticallyAnalyseExpressionDeclaration(
    parentScope: ProcedureSymbol|MacroSymbol,
    expression: Expression,
    symbols: SymbolDeclarationStore,
    errorCollector: ErrorCollector
) {
    if (expression instanceof ClassDeclarationExpression) {
        ClassSymbol.analyseDeclaration(parentScope, expression, symbols, errorCollector);
    } else if (expression instanceof TypeGuardExpression) {

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

export function staticallyAnalyseExpression(
    parentScope: ProcedureSymbol|MacroSymbol,
    scopeTraversal: Set<Expression>,
    expression: Expression,
    symbols: SymbolDeclarationStore,
    errorCollector: ErrorCollector
) {
    if (expression instanceof AccessorExpression) {
        staticallyAnalyseExpression(parentScope, scopeTraversal, expression.base, symbols, errorCollector);
    } else if (expression instanceof AssignmentExpression) {
        if (expression.reference instanceof KeywordExpression) {
            const reference = parentScope.getIdentifierReference(expression.reference.keyword);
            if (reference === undefined) throw new Error(`Could not find reference '${expression.reference.keyword}'`);
    
            if (!reference.flags.has(SymbolFlag.Hoisted) && !scopeTraversal.has(reference.expression))
                throw new Error(`Reference not declared '${expression.reference.keyword}'`);

            if (reference instanceof ParameterSymbol) {
                reference.flags.add(SymbolFlag.ParamReassigned);
            }
        } else {
            staticallyAnalyseExpression(parentScope, scopeTraversal, expression.reference, symbols, errorCollector);
        }

        staticallyAnalyseExpression(parentScope, scopeTraversal, expression.value, symbols, errorCollector);
    } else if (expression instanceof ClassDeclarationExpression) {
        for (const method of expression.methods) {
            staticallyAnalyseExpression(parentScope, scopeTraversal, method, symbols, errorCollector);
        }
    } else if (expression instanceof FunctionCallExpression) {
        staticallyAnalyseExpression(parentScope, scopeTraversal, expression.reference, symbols, errorCollector);
    } else if (expression instanceof IfStatementExpression) {
        staticallyAnalyseExpression(parentScope, scopeTraversal, expression.condition, symbols, errorCollector);
        staticallyAnalyseExpression(parentScope, scopeTraversal, expression.block, symbols, errorCollector);
        if (expression.elseBlock !== undefined) {
            staticallyAnalyseExpression(parentScope, scopeTraversal, expression.elseBlock, symbols, errorCollector);
        }
    } else if (expression instanceof KeywordExpression) {
        const reference = parentScope.getIdentifierReference(expression.keyword);
        if (reference === undefined) throw new Error(`Could not find reference '${expression.keyword}'`);

        if (!reference.flags.has(SymbolFlag.Hoisted) && !scopeTraversal.has(reference.expression))
            throw new Error(`Reference not declared '${expression.keyword}'`);
            
        if (reference instanceof ProcedureSymbol) {
            reference.flags.add(SymbolFlag.ProcUsedAsValue);
        }
        let parent: ProcedureSymbol|MacroSymbol|ClassSymbol|undefined = parentScope;
        while (parent !== undefined) {
            if (parentScope === reference) {
                reference.flags.add(SymbolFlag.ProcUsedRecursively);
                break;
            }
            parent = parent.parent;
        }
    } else if (expression instanceof MacroDeclarationExpression) {
        for (const param of expression.parameters) {
            staticallyAnalyseExpression(parentScope, scopeTraversal, param, symbols, errorCollector);
        }
        const macroDeclaration = symbols.getSymbol(expression);
        if (macroDeclaration === undefined || !(macroDeclaration instanceof MacroSymbol)) throw new Error("??");
        staticallyAnalyseExpression(macroDeclaration, scopeTraversal, expression.block, symbols, errorCollector);
    } else if (expression instanceof NumberExpression) {
        // no-op
    } else if (expression instanceof OperatorExpression) {
        staticallyAnalyseExpression(parentScope, scopeTraversal, expression.left, symbols, errorCollector);
        staticallyAnalyseExpression(parentScope, scopeTraversal, expression.right, symbols, errorCollector);
    } else if (expression instanceof ParameterDeclarationExpression) {
        // todo: validate type
        if (expression.defaultValue !== undefined) {
            staticallyAnalyseExpression(parentScope, scopeTraversal, expression.defaultValue, symbols, errorCollector);
        }
    } else if (expression instanceof ParenthesisExpression) {
        staticallyAnalyseBlock(parentScope, scopeTraversal, expression.expressions, symbols, errorCollector);
    } else if (expression instanceof ProcDeclarationExpression) {
        for (const param of expression.parameters) {
            staticallyAnalyseExpression(parentScope, scopeTraversal, param, symbols, errorCollector);
        }
        const procDeclaration = symbols.getSymbol(expression);
        scopeTraversal.add(expression);
        if (procDeclaration === undefined || !(procDeclaration instanceof ProcedureSymbol)) throw new Error("??");
        staticallyAnalyseExpression(procDeclaration, scopeTraversal, expression.block, symbols, errorCollector);
        return; // expression added to scope traversal
    } else if (expression instanceof ReturnStatementExpression) {
        if (expression.expression !== undefined) {
            staticallyAnalyseExpression(parentScope, scopeTraversal, expression.expression, symbols, errorCollector);
        }
    } else if (expression instanceof StringExpression) {
        // no-op
    } else if (expression instanceof StructFieldsExpression) {
        // todo: check fields
    } else if (expression instanceof TypeGuardExpression) {
        // todo: check reference & type
    } else if (expression instanceof UnaryOperatorExpression) {
        staticallyAnalyseExpression(parentScope, scopeTraversal, expression.expression, symbols, errorCollector);
    } else if (expression instanceof WhileStatementExpression) {
        staticallyAnalyseExpression(parentScope, scopeTraversal, expression.condition, symbols, errorCollector);
        staticallyAnalyseExpression(parentScope, scopeTraversal, expression.block, symbols, errorCollector);
    }
    scopeTraversal.add(expression);
}

export function staticallyAnalyseBlock(
    parentScope: ProcedureSymbol|MacroSymbol,
    scopeTraversal: Set<Expression>,
    block: Expression[],
    symbols: SymbolDeclarationStore,
    errorCollector: ErrorCollector
) {
    for (const expression of block) {
        staticallyAnalyseExpression(parentScope, scopeTraversal, expression, symbols, errorCollector);
    }
}