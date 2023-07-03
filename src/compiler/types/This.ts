import { Expression } from "../../expression";
import { ClassSymbol, ScopedSymbol } from "../symbols";
import { Type } from "./Type";

export class UnresolvedType {
    constructor(public readonly expression: Expression, public readonly scope: ScopedSymbol|ClassSymbol) { }

    getName(): string {
        return this.scope.name;
    }

    isEquivalentTo(other: Type): boolean {
        return false;
    }
}