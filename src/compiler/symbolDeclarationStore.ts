import { ClassDeclarationExpression, Expression, MacroDeclarationExpression, ParameterDeclarationExpression, ProcDeclarationExpression, TypeAliasDeclarationExpression, TypeGuardExpression, VariableDeclarationExpression } from "../expression";
import { IdGenerator } from "./IdGenerator";
import { ClassSymbol, CodeSymbol, FieldSymbol, MacroSymbol, ParameterSymbol, ProcedureSymbol, VariableSymbol } from "./symbols";
import { TypeAliasSymbol } from "./symbols/TypeAlias";

const CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!#$%()*+,-./:;=?@[]^_\\`{|}~";
export class SymbolDeclarationStore {
    protected expressionToSymbol: Map<Expression, CodeSymbol>;

    constructor(public readonly idGenerator: IdGenerator) {
        this.expressionToSymbol = new Map;
    }
    
    addVariable(expression: VariableDeclarationExpression, parent: ProcedureSymbol) {
        const id = this.idGenerator.nextId();
        const variable = new VariableSymbol(id, parent, expression.identifier, expression);
        parent.addSymbol(variable);
        this.expressionToSymbol.set(expression, variable);
        return variable;
    }

    addTypeAlias(expression: TypeAliasDeclarationExpression, parent: ProcedureSymbol) {
        const id = this.idGenerator.nextId();
        const variable = new TypeAliasSymbol(id, parent, expression.name, expression);
        parent.addSymbol(variable);
        this.expressionToSymbol.set(expression, variable);
        return variable;
    }

    addProcedure(expression: ProcDeclarationExpression, parent: ProcedureSymbol|ClassSymbol) {
        const id = this.idGenerator.nextId();
        const proc = new ProcedureSymbol(id, parent, expression.identifier!, expression);
        if (parent instanceof ClassSymbol) {
            parent.addChild(proc);
        } else {
            parent.addSymbol(proc);
        }
        this.expressionToSymbol.set(expression, proc);
        return proc;
    }

    addParameter(expression: ParameterDeclarationExpression, parent: ProcedureSymbol|MacroSymbol) {
        const id = this.idGenerator.nextId();
        const variable = new ParameterSymbol(id, parent, expression.identifier, expression);
        parent.addSymbol(variable);
        this.expressionToSymbol.set(expression, variable);
        return variable;
    }

    addField(expression: TypeGuardExpression, parent: ClassSymbol) {
        const id = this.idGenerator.nextId();
        const field = new FieldSymbol(id, parent, expression.reference.keyword, expression);
        parent.addChild(field);
        this.expressionToSymbol.set(expression, field);
        return field;
    }

    addClass(expression: ClassDeclarationExpression, parent: ProcedureSymbol) {
        const id = this.idGenerator.nextId();
        const klass = new ClassSymbol(id, parent, expression.identifier, expression);
        parent.addSymbol(klass);
        this.expressionToSymbol.set(expression, klass);
        return klass;
    }

    addMacro(expression: MacroDeclarationExpression, parent: ProcedureSymbol) {
        const id = this.idGenerator.nextId();
        const macro = new MacroSymbol(id, parent, expression.identifier, expression);
        parent.addSymbol(macro);
        this.expressionToSymbol.set(expression, macro);
        return macro;
    }

    getSymbol(origin: Expression) {
        return this.expressionToSymbol.get(origin);
    }
}