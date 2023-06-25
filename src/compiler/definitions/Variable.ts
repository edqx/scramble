import { ErrorCollector } from "../../errorCollector";
import { VariableDeclarationExpression } from "../../expression";
import { ListDefinition, VariableDefinition } from "../../scratch";
import { ExistingTypes } from "../ExistingTypes";
import { IdGenerator } from "../IdGenerator";
import { Sprite } from "../Sprite";
import { resolveSymbolType } from "../resolveSymbolType";
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

    protected _cachedVarDefinition: ListDefinition|VariableDefinition|undefined;
    
    constructor(id: string, parent: ProcedureSymbol|undefined, name: string, expression: VariableDeclarationExpression) {
        super(id, parent, SymbolType.Variable, name, expression);
    }
    
    getVarDefinitionReference(uniqueIds: IdGenerator, existingTypes: ExistingTypes, errorCollector: ErrorCollector, sprite: Sprite) {
        if (this._cachedVarDefinition !== undefined) return this._cachedVarDefinition;

        const typeSignature = resolveSymbolType(this, existingTypes, errorCollector);
        if (typeSignature.size > 1) {
            const list = sprite.createList(uniqueIds.nextId(), this.name);
            this._cachedVarDefinition = list;
            return list;
        } else {
            const variable = sprite.createVariable(uniqueIds.nextId(), this.name);
            this._cachedVarDefinition = variable;
            return variable;
        }
    }
}