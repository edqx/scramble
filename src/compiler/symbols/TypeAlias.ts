import { ErrorCollector } from "../../errorCollector";
import { TypeAliasDeclarationExpression } from "../../expression";
import { SymbolDeclarationStore } from "../symbolDeclarationStore";
import { ProcedureSymbol } from "./Procedure";
import { CodeSymbol, SymbolType } from "./Symbol";

export class TypeAliasSymbol extends CodeSymbol<TypeAliasDeclarationExpression> {
    static analyseDeclaration(
        parentScope: ProcedureSymbol,
        expression: TypeAliasDeclarationExpression,
        symbols: SymbolDeclarationStore,
        errorCollector: ErrorCollector
    ) {
        const error = parentScope.getErrorNotTaken(expression, expression.name);
        if (error) return errorCollector.addError(error);

        // todo: validate type
        symbols.addTypeAlias(expression, parentScope);
    }
    
    constructor(id: string, parent: ProcedureSymbol|undefined, name: string, expression: TypeAliasDeclarationExpression) {
        super(id, parent, SymbolType.Type, name, expression);
    }
}