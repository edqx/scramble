export abstract class Type {
    size = 1;
    
    getSize() {
        return this.size;
    }

    abstract getName(): string;
    abstract isEquivalentTo(other: Type): boolean;
}