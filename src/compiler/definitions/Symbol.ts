import { CompilerError, ErrorCode } from "../../error";
import { Expression } from "../../expression";
import { ClassSymbol } from "./Class";
import { MacroSymbol } from "./Macro";
import { ProcedureSymbol } from "./Procedure";

export enum SymbolType {
    Variable,
    Parameter,
    Procedure,
    Class,
    Field,
    Macro
}

export enum SymbolFlag {
    Hoisted,
    ParamReassigned,
    ProcUsedRecursively,
    ProcUsedAsValue,
    VariableAllocatedOnHeap
}

export abstract class CodeSymbol<ExpressionType extends Expression = Expression> {
    flags: Set<SymbolFlag>;
    signature: ClassSymbol|ProcedureSymbol|undefined;

    constructor(
        public readonly id: string,
        public readonly parent: ProcedureSymbol|MacroSymbol|ClassSymbol|undefined,
        public readonly type: SymbolType,
        public readonly name: string,
        public readonly expression: ExpressionType
    ) {
        this.flags = new Set;
        this.signature = undefined;
    }

    setSignature(signature: ClassSymbol|ProcedureSymbol) {
        this.signature = signature;
    }
}

export class ScopedSymbol<ExpressionType extends Expression = Expression> extends CodeSymbol<ExpressionType> {
    symbols: Map<string, CodeSymbol>;

    constructor(id: string, parent: ProcedureSymbol|MacroSymbol|ClassSymbol|undefined, type: SymbolType, name: string, expression: ExpressionType) {
        super(id, parent, type, name, expression);

        this.symbols = new Map;
    }

    getErrorNotTaken(expression: Expression, identifier: string) {
        const existingRef = this.symbols.get(identifier);
        if (existingRef) {
            return new CompilerError(ErrorCode.IdentifierInUse)
                        .addError(expression.position, "Identifier in use")
                        .addInfo(existingRef.expression.position, `'${existingRef.name}' has already been declared in this scope`);
        }

        return null;
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