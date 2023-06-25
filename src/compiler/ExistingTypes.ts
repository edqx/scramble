import { CodeSymbol } from "./definitions";
import { Type } from "./types";

export class ExistingTypes {
    typeCache: Map<CodeSymbol, Type>;

    constructor() {
        this.typeCache = new Map;
    }

    getOrCreateTypeForSymbol(symbol: CodeSymbol, type: Type) {
        const cachedType = this.typeCache.get(symbol);
        if (cachedType) return cachedType;
        
        this.typeCache.set(symbol, type);
        return type;
    }
}