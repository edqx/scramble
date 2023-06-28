import { ErrorCollector } from "../../errorCollector";
import { TypeGuardExpression } from "../../expression";
import { SymbolDeclarationStore } from "../symbolDeclarationStore";
import { ClassSymbol } from "./Class";
import { CodeSymbol, SymbolType } from "./Symbol";

export class FieldSymbol extends CodeSymbol<TypeGuardExpression> {
    static analyseDeclaration(
        parentScope: ClassSymbol,
        expression: TypeGuardExpression,
        symbols: SymbolDeclarationStore,
        errorCollector: ErrorCollector
    ) {
        const error = parentScope.getErrorNotTaken(expression, expression.reference.keyword);
        if (error) return errorCollector.addError(error);

        symbols.addField(expression, parentScope);
    }
    
    constructor(id: string, parent: ClassSymbol|undefined, name: string, expression: TypeGuardExpression) {
        super(id, parent, SymbolType.Field, name, expression);
    }
}