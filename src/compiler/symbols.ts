import { Expression } from "../expression";

export enum SymbolType {
    Variable,
    Procedure,
    Class,
    Field,
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
    signature: ClassSymbol|ProcedureSymbol|undefined;

    constructor(
        public readonly id: string,
        public readonly parent: ProcedureSymbol|ClassSymbol|undefined,
        public readonly type: SymbolType,
        public readonly name: string,
        public readonly declaredAt: Expression
    ) {
        this.flags = new Set;
        this.signature = undefined;
    }

    setSignature(signature: ClassSymbol|ProcedureSymbol) {
        this.signature = signature;
    }
}

export class VariableSymbol extends CodeSymbol {
    constructor(id: string, parent: ProcedureSymbol|undefined, name: string, declaredAt: Expression) {
        super(id, parent, SymbolType.Variable, name, declaredAt);
    }
}

export class FieldSymbol extends CodeSymbol {
    constructor(id: string, parent: ClassSymbol|undefined, name: string, declaredAt: Expression) {
        super(id, parent, SymbolType.Field, name, declaredAt);
    }
}

export class ProcedureSymbol extends CodeSymbol {
    symbols: Map<string, CodeSymbol>;

    constructor(id: string, parent: ProcedureSymbol|ClassSymbol|undefined, name: string, declaredAt: Expression) {
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

export class ClassSymbol extends CodeSymbol {
    children: Map<string, CodeSymbol>;

    constructor(id: string, parent: ProcedureSymbol|undefined, name: string, declaredAt: Expression) {
        super(id, parent, SymbolType.Class, name, declaredAt);

        this.children = new Map;
        this.flags.add(SymbolFlag.Hoisted);
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

export class MacroSymbol extends CodeSymbol {
    symbols: Map<string, CodeSymbol>;

    constructor(id: string, parent: ProcedureSymbol|undefined, name: string, declaredAt: Expression) {
        super(id, parent, SymbolType.Macro, name, declaredAt);

        this.symbols = new Map;
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