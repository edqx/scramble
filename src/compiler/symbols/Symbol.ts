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
    Macro,
    Type
}

export enum SymbolFlag {
    Hoisted,
    ParamReassigned,
    ProcUsedRecursively,
    ProcIsMethod,
    ProcUsedAsValue,
    MethodThisReassigned,
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

    getNearestScopeParent() {
        let parent = this.parent;
        while (parent !== undefined) {
            if (parent instanceof ScopedSymbol) return parent;
            parent = parent.parent;
        }

        return undefined;
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
        if (this.parent instanceof ClassSymbol) {
            if (name === "this") {
                return this.parent;
            }
        }

        const symbol = this.symbols.get(name);
        if (symbol === undefined) return this.parent?.getIdentifierReference(name) || undefined;
        return symbol;
    }

    addSymbol(symbol: CodeSymbol) {
        this.symbols.set(symbol.name, symbol);
    }
}