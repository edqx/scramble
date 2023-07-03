import { ClassDeclarationExpression, Expression } from "../../expression";
import { CodeSymbol, SymbolType, SymbolFlag } from "./Symbol";
import { ProcedureSymbol } from "./Procedure";
import { SymbolDeclarationStore } from "../symbolDeclarationStore";
import { ErrorCollector } from "../../errorCollector";
import { MacroSymbol } from "./Macro";
import { FieldSymbol } from "./Field";
import { CompilerError, ErrorCode } from "../../error";
import { CompositeDefinition, ListDefinition, Sprite, VariableDefinition } from "../definitions";
import { IdGenerator } from "../IdGenerator";
import { ExistingTypes } from "../ExistingTypes";
import { getClassInstanceType } from "../resolveTypeName";

export class ClassSymbol extends CodeSymbol<ClassDeclarationExpression> {
    children: Map<string, CodeSymbol>;

    static analyseDeclaration(
        parentScope: ProcedureSymbol|MacroSymbol,
        expression: ClassDeclarationExpression,
        symbols: SymbolDeclarationStore,
        errorCollector: ErrorCollector
    ) {
        if (parentScope instanceof MacroSymbol) throw new Error("Cannot declare class in macro");

        const error = parentScope.getErrorNotTaken(expression, expression.identifier);
        if (error) return errorCollector.addError(error);

        const classSymbol = symbols.addClass(expression, parentScope);
        for (const field of classSymbol.expression.fields) FieldSymbol.analyseDeclaration(classSymbol, field, symbols, errorCollector);
        for (const method of classSymbol.expression.methods) ProcedureSymbol.analyseDeclaration(classSymbol, method, symbols, errorCollector);
    }
    
    protected _cachedMutatedThisDefinition: ListDefinition|VariableDefinition|undefined;

    constructor(id: string, parent: ProcedureSymbol|undefined, name: string, expression: ClassDeclarationExpression) {
        super(id, parent, SymbolType.Class, name, expression);

        this.children = new Map;
        this.flags.add(SymbolFlag.Hoisted);
    }

    getMutatedThisDefinitionReference(sprite: Sprite, uniqueIds: IdGenerator, existingTypes: ExistingTypes, errorCollector: ErrorCollector) {
        if (this._cachedMutatedThisDefinition !== undefined) return this._cachedMutatedThisDefinition;
        
        const typeSignature = getClassInstanceType(this, existingTypes, errorCollector);
        if (typeSignature.getSize() > 1) { // temp?
            const variables = [];
            for (let i = 0; i < typeSignature.getSize(); i++) variables.push(sprite.createVariable(uniqueIds.nextId(), "mut:" + this.name + "_" + i));
            const composite = new CompositeDefinition(typeSignature, variables);
            this._cachedMutatedThisDefinition
            return composite;
        }

        if (typeSignature.getSize() > 1) {
            const list = sprite.createList(uniqueIds.nextId(), "mut:" + this.name, typeSignature.getSize());
            this._cachedMutatedThisDefinition = list;
            return list;
        } else {
            const variable = sprite.createVariable(uniqueIds.nextId(), "mut:" + this.name);
            this._cachedMutatedThisDefinition = variable;
            return variable;
        }
    }

    getErrorNotTaken(expression: Expression, identifier: string) {
        const existingRef = this.children.get(identifier);
        if (existingRef) {
            return new CompilerError(ErrorCode.IdentifierInUse)
                        .addError(expression.position, "Identifier in use")
                        .addInfo(existingRef.expression.position, `'${existingRef.name}' has already been declared in this scope`);
        }

        return null;
    }

    isChildNameTaken(name: string) {
        return this.children.has(name);
    }

    getIdentifierReference(name: string): CodeSymbol|undefined {
        return this.parent?.getIdentifierReference(name);
    }

    addChild(symbol: CodeSymbol) {
        this.children.set(symbol.name, symbol);
    }
}

class A{
    method() {
        return this.method;
    }
}