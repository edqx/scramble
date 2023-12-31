import { ErrorCollector } from "../../errorCollector";
import { VariableDeclarationExpression } from "../../expression";
import { ExistingTypes } from "../ExistingTypes";
import { IdGenerator } from "../IdGenerator";
import { CompositeDefinition, Sprite } from "../definitions";
import { Definition } from "../definitions/Definition";
import { resolveSymbolType, resolveThisType } from "../resolveSymbolType";
import { SymbolDeclarationStore } from "../symbolDeclarationStore";
import { ArrayType, ClassInstanceType } from "../types";
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

        const typeSignature = resolveThisType(resolveSymbolType(this, existingTypes, errorCollector), existingTypes, errorCollector);

        if (!(typeSignature instanceof ArrayType || (typeSignature instanceof ClassInstanceType && typeSignature.doesContainIndexable(existingTypes, errorCollector))) && typeSignature.getSize() > 1) { // temp?
            const variables = [];
            for (let i = 0; i < typeSignature.getSize(); i++) variables.push(sprite.createVariable(uniqueIds.nextId(), this.name + "_" + i));
            const composite = new CompositeDefinition(typeSignature, variables);
            this._cachedVarDefinition = composite;
            return composite;
        }

        if (typeSignature.getSize() > 1) {
            const list = sprite.createList(uniqueIds.nextId(), this.name, typeSignature.getSize());
            this._cachedVarDefinition = list;
            return list;
        } else {
            const variable = sprite.createVariable(uniqueIds.nextId(), this.name);
            this._cachedVarDefinition = variable;
            return variable;
        }
    }
}