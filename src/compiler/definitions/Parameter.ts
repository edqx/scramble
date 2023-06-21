import { ErrorCollector } from "../../errorCollector";
import { ParameterDeclarationExpression } from "../../expression";
import { SymbolDeclarationStore } from "../symbolDeclarationStore";
import { MacroSymbol } from "./Macro";
import { ProcedureSymbol } from "./Procedure";
import { CodeSymbol, SymbolType } from "./Symbol";

export class ParameterSymbol extends CodeSymbol<ParameterDeclarationExpression> {
    static analyseDeclaration(
        parentScope: ProcedureSymbol|MacroSymbol,
        expression: ParameterDeclarationExpression,
        symbols: SymbolDeclarationStore,
        errorCollector: ErrorCollector
    ) {
        const error = parentScope.getErrorNotTaken(expression, expression.identifier);
        if (error) return errorCollector.addError(error);

        // todo: validate type
        symbols.addParameter(expression, parentScope);
    }
    
    constructor(id: string, parent: ProcedureSymbol|MacroSymbol|undefined, name: string, expression: ParameterDeclarationExpression) {
        super(id, parent, SymbolType.Parameter, name, expression);
    }
}