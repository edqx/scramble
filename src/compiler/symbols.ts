import { Expression } from "../expression";

export enum SymbolType {
    Variable,
    Procedure,
    Macro
}

export enum SymbolFlag {
    Hoisted,
    VariableIsParam,
    ParamReassigned,
    ProcUsedRecursively,
    ProcUsedAsValue,
    VariableAllocatedOnHeap
}

export abstract class CodeSymbol {
    flags: Set<SymbolFlag>;

    constructor(
        public readonly id: string,
        public readonly parent: ProcedureSymbol|undefined,
        public readonly type: SymbolType,
        public readonly name: string,
        public readonly declaredAt: Expression
    ) {
        this.flags = new Set;
    }
}

export class VariableSymbol extends CodeSymbol {
    constructor(id: string, parent: ProcedureSymbol|undefined, name: string, declaredAt: Expression) {
        super(id, parent, SymbolType.Variable, name, declaredAt);
    }
}

export class ProcedureSymbol extends CodeSymbol {
    symbols: Map<string, CodeSymbol>;

    constructor(id: string, parent: ProcedureSymbol|undefined, name: string, declaredAt: Expression) {
        super(id, parent, SymbolType.Procedure, name, declaredAt);

        this.symbols = new Map;
        this.flags.add(SymbolFlag.Hoisted);
    }

    isSymbolNameTaken(name: string) {
        return this.symbols.has(name);
    }

    getIdentifierReference(name: string): CodeSymbol|undefined {
        const symbol = this.symbols.get(name);
        if (symbol === undefined) return this.parent?.getIdentifierReference(name) || undefined;
        return symbol;
    }

    addSymbol(symbol: CodeSymbol) {
        this.symbols.set(symbol.name, symbol);
    }
}

export class MacroSymbol extends CodeSymbol {
    constructor(id: string, parent: ProcedureSymbol|undefined, name: string, declaredAt: Expression) {
        super(id, parent, SymbolType.Macro, name, declaredAt);
    }
}