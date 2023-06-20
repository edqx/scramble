import { Expression } from "../expression";
import { ClassSymbol, CodeSymbol, FieldSymbol, MacroSymbol, ProcedureSymbol, VariableSymbol } from "./symbols";

const CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!#$%()*+,-./:;=?@[]^_\\`{|}~";
export class SymbolDeclarationStore {
    protected expressionToSymbol: Map<Expression, CodeSymbol>;
    protected idIndex: number;

    constructor() {
        this.expressionToSymbol = new Map;
        this.idIndex = 0;
    }

    nextId() {
        let n = this.idIndex;
        let str = CHARS[n % CHARS.length];
        while (n >= CHARS.length) {
            n = Math.floor(n / CHARS.length) - 1;
            str += CHARS[n % CHARS.length];
        }
        this.idIndex++;
        return str;
    }

    addVariable(expression: Expression, parent: ProcedureSymbol, name: string) {
        const id = this.nextId();
        const variable = new VariableSymbol(id, parent, name, expression);
        parent.addSymbol(variable);
        this.expressionToSymbol.set(expression, variable);
        return variable;
    }

    addProcedure(expression: Expression, parent: ProcedureSymbol|ClassSymbol, name: string) {
        const id = this.nextId();
        const proc = new ProcedureSymbol(id, parent, name, expression);
        if (parent instanceof ClassSymbol) {
            parent.addChild(proc);
        } else {
            parent.addSymbol(proc);
        }
        this.expressionToSymbol.set(expression, proc);
        return proc;
    }

    addField(expression: Expression, parent: ClassSymbol, name: string) {
        const id = this.nextId();
        const field = new FieldSymbol(id, parent, name, expression);
        parent.addChild(field);
        this.expressionToSymbol.set(expression, field);
        return field;
    }

    addClass(expression: Expression, parent: ProcedureSymbol, name: string) {
        const id = this.nextId();
        const klass = new ClassSymbol(id, parent, name, expression);
        parent.addSymbol(klass);
        this.expressionToSymbol.set(expression, klass);
        return klass;
    }

    addMacro(expression: Expression, parent: ProcedureSymbol, name: string) {
        const id = this.nextId();
        const macro = new MacroSymbol(id, parent, name, expression);
        parent.addSymbol(macro);
        this.expressionToSymbol.set(expression, macro);
        return macro;
    }

    getSymbol(origin: Expression) {
        return this.expressionToSymbol.get(origin);
    }
}