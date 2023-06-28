import { ErrorCollector } from "../../errorCollector";
import { MacroDeclarationExpression, ParameterDeclarationExpression } from "../../expression";
import { staticallyAnalyseExpressionDeclaration } from "../analysis";
import { SymbolDeclarationStore } from "../symbolDeclarationStore";
import { ClassSymbol } from "./Class";
import { ParameterSymbol } from "./Parameter";
import { ProcedureSymbol } from "./Procedure";
import { ScopedSymbol, SymbolType } from "./Symbol";

export class MacroSymbol extends ScopedSymbol<MacroDeclarationExpression> {
    static analyseDeclaration(
        parentScope: ProcedureSymbol|MacroSymbol,
        expression: MacroDeclarationExpression,
        symbols: SymbolDeclarationStore,
        errorCollector: ErrorCollector
    ) {
        if (parentScope instanceof MacroSymbol) throw new Error("Cannot declare macro in macro");

        const error = parentScope.getErrorNotTaken(expression, expression.identifier);
        if (error) return errorCollector.addError(error);
        
        const proc = symbols.addMacro(expression, parentScope);
        for (const parameterDeclarationExpression of expression.parameters) {
            if (parameterDeclarationExpression instanceof ParameterDeclarationExpression) {
                ParameterSymbol.analyseDeclaration(proc, parameterDeclarationExpression, symbols, errorCollector);
            }
        }
        staticallyAnalyseExpressionDeclaration(proc, expression.block, symbols, errorCollector);
    }

    constructor(id: string, parent: ProcedureSymbol|ClassSymbol|undefined, name: string, expression: MacroDeclarationExpression) {
        super(id, parent, SymbolType.Macro, name, expression);
    }
}