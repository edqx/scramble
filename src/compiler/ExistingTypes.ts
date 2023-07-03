import { CodeSymbol } from "./symbols";
import { Type } from "./types";

export class ExistingTypes {
    typeCache: Map<CodeSymbol, Type>;

    constructor() {
        this.typeCache = new Map;
    }

    getOrCreateTypeForSymbol<T extends Type>(symbol: CodeSymbol, type: T) {
        const cachedType = this.typeCache.get(symbol);
        if (cachedType) return cachedType as T;
        
        this.typeCache.set(symbol, type);
        return type;
    }
}