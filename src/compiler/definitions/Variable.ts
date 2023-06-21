import { ErrorCollector } from "../../errorCollector";
import { VariableDeclarationExpression } from "../../expression";
import { SymbolDeclarationStore } from "../symbolDeclarationStore";
import { ProcedureSymbol } from "./Procedure";
import { CodeSymbol, SymbolFlag, SymbolType } from "./Symbol";

export class VariableSymbol extends CodeSymbol<VariableDeclarationExpression> {
    static analyseDeclaration(
        parentScope: ProcedureSymbol,
        expression: VariableDeclarationExpression,
        symbols: SymbolDeclarationStore,
        errorCollector: ErrorCollector
    ) {
        const error = parentScope.getErrorNotTaken(expression, expression.identifier);
        if (error) return errorCollector.addError(error);

        // todo: validate type
        const varSymbol = symbols.addVariable(expression, parentScope);
        if (expression.varType === "let") {
            varSymbol.flags.add(SymbolFlag.VariableAllocatedOnHeap);
        }
    }
    
    constructor(id: string, parent: ProcedureSymbol|undefined, name: string, expression: VariableDeclarationExpression) {
        super(id, parent, SymbolType.Variable, name, expression);
    }
}