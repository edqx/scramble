export abstract class Type {
    size = 1;

    abstract getName(): string;
    abstract isEquivalentTo(other: Type): boolean;
}