import { ErrorCollector } from "../../errorCollector";
import { VariableDeclarationExpression } from "../../expression";
import { ExistingTypes } from "../ExistingTypes";
import { IdGenerator } from "../IdGenerator";
import { CompositeDefinition, ListDefinition, Sprite, VariableDefinition } from "../definitions";
import { Definition } from "../definitions/Definition";
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
    
    protected _cachedVarDefinition: Definition|undefined;

    constructor(id: string, parent: ProcedureSymbol|undefined, name: string, expression: VariableDeclarationExpression) {
        super(id, parent, SymbolType.Variable, name, expression);
    }

    getVarDefinitionReference(sprite: Sprite, uniqueIds: IdGenerator, existingTypes: ExistingTypes, errorCollector: ErrorCollector) {
        if (this._cachedVarDefinition !== undefined) return this._cachedVarDefinition;

        const typeSignature = resolveSymbolType(this, existingTypes, errorCollector);
        if (typeSignature.size > 1) { // temp?
            const variables = [];
            for (let i = 0; i < typeSignature.size; i++) variables.push(sprite.createVariable(uniqueIds.nextId(), this.name + "_" + i));
            const composite = new CompositeDefinition(typeSignature, variables);
            this._cachedVarDefinition = composite;
            return composite;
        }

        if (typeSignature.size > 1) {
            const list = sprite.createList(uniqueIds.nextId(), this.name, typeSignature.size);
            this._cachedVarDefinition = list;
            return list;
        } else {
            const variable = sprite.createVariable(uniqueIds.nextId(), this.name);
            this._cachedVarDefinition = variable;
            return variable;
        }
    }
}