import { ClassDeclarationExpression, Expression, TypeGuardExpression } from "../../expression";
import { CodeSymbol, SymbolType, SymbolFlag } from "./Symbol";
import { ProcedureSymbol } from "./Procedure";
import { SymbolDeclarationStore } from "../symbolDeclarationStore";
import { ErrorCollector } from "../../errorCollector";
import { MacroSymbol } from "./Macro";
import { FieldSymbol } from "./Field";
import { CompilerError, ErrorCode } from "../../error";

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

    constructor(id: string, parent: ProcedureSymbol|undefined, name: string, expression: ClassDeclarationExpression) {
        super(id, parent, SymbolType.Class, name, expression);

        this.children = new Map;
        this.flags.add(SymbolFlag.Hoisted);
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