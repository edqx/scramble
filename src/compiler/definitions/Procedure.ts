import { ErrorCollector } from "../../errorCollector";
import { ParenthesisExpression, ProcDeclarationExpression, ScriptExpression } from "../../expression";
import { staticallyAnalyseExpressionDeclaration } from "../analysis";
import { SymbolDeclarationStore } from "../symbolDeclarationStore";
import { ClassSymbol } from "./Class";
import { MacroSymbol } from "./Macro";
import { ParameterSymbol } from "./Parameter";
import { ScopedSymbol, SymbolFlag, SymbolType } from "./Symbol";

export class ProcedureSymbol extends ScopedSymbol<ProcDeclarationExpression|ScriptExpression> {
    static analyseDeclaration(
        parentScope: ProcedureSymbol|MacroSymbol|ClassSymbol,
        expression: ProcDeclarationExpression,
        symbols: SymbolDeclarationStore,
        errorCollector: ErrorCollector
    ) {
        if (parentScope instanceof MacroSymbol) throw new Error("Cannot declare procedure in macro");
        
        const error = parentScope.getErrorNotTaken(expression, expression.identifier);
        if (error) return errorCollector.addError(error);

        const proc = symbols.addProcedure(expression, parentScope);
        for (const parameterDeclarationExpression of expression.parameters) {
            ParameterSymbol.analyseDeclaration(proc, parameterDeclarationExpression, symbols, errorCollector);
        }
        if (expression.block instanceof ParenthesisExpression) {
            for (const expr of expression.block.expressions) {
                staticallyAnalyseExpressionDeclaration(proc, expr, symbols, errorCollector);
            }
        } else {
            staticallyAnalyseExpressionDeclaration(proc, expression.block, symbols, errorCollector);
        }
    }
    
    constructor(id: string, parent: ProcedureSymbol|ClassSymbol|undefined, name: string, expression: ProcDeclarationExpression|ScriptExpression) {
        super(id, parent, SymbolType.Procedure, name, expression);

        this.flags.add(SymbolFlag.Hoisted);
    }
}