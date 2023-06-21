import { ErrorCollector } from "../errorCollector";
import { AccessorExpression, AssignmentExpression, Expression, FunctionCallExpression, IfStatementExpression, KeywordExpression, NumberExpression, OperatorExpression, ParenthesisExpression, ProcDeclarationExpression, ReturnStatementExpression, StringExpression, StructFieldsExpression, VariableDeclarationExpression, WhileStatementExpression } from "../expression";
import { ClassSymbol, CodeSymbol, FieldSymbol, MacroSymbol, ParameterSymbol, ProcedureSymbol, ScopedSymbol, VariableSymbol } from "./definitions";
import { SymbolDeclarationStore } from "./symbolDeclarationStore";

export abstract class TypeSignature {
    abstract getName(): string;
}

const PRIMITIVE_TYPES = new Set([ "string", "number" ])

export class PrimitiveType extends TypeSignature {
    constructor(public readonly typeName: string) { super(); }

    getName(): string {
        return this.typeName;
    }
}

export class ClassInstanceType extends TypeSignature {
    constructor(public readonly classSymbol: ClassSymbol) { super(); }

    getName(): string {
        return this.classSymbol.name;
    }
}

export class FunctionSignatureType extends TypeSignature {
    constructor(public readonly args: TypeSignature[], public readonly returnType: TypeSignature) { super(); }

    getName(): string {
        return "proc(" + this.args.map(arg => arg.getName()).join(", ") + "): " + this.returnType.getName();
    }
}

export class VoidType extends TypeSignature {
    getName(): string {
        return "void";
    }
}

export function resolveTypeName(scope: ScopedSymbol|ClassSymbol, name: string) {
    if (PRIMITIVE_TYPES.has(name))
        return new PrimitiveType(name);

    const typeSymbol = scope.getIdentifierReference(name);
    if (typeSymbol === undefined || !(typeSymbol instanceof ClassSymbol)) throw new Error(`Invalid type reference '${name}'`);

    return new ClassInstanceType(typeSymbol);
}

export function resolveBlockReturnTypes(block: Expression, scope: ScopedSymbol|ClassSymbol): TypeSignature[] {
    if (block instanceof ParenthesisExpression) {
        const types = [];
        for (const expression of block.expressions) {
            if (expression instanceof ReturnStatementExpression) {
                if (expression.expression !== undefined) {
                    types.push(inferTypeFromExpression(expression.expression, scope));
                } else {
                    types.push(new VoidType);
                }
                break;
            } else if (expression instanceof IfStatementExpression) {
                types.push(...resolveBlockReturnTypes(expression.block, scope));
                if (expression.elseBlock !== undefined) types.push(...resolveBlockReturnTypes(expression.elseBlock, scope));;
            } else if (expression instanceof WhileStatementExpression) {
                types.push(...resolveBlockReturnTypes(expression.block, scope));
            }
        }
        return types;
    } else if (block instanceof ReturnStatementExpression) {
        if (block.expression !== undefined) {
            return [ inferTypeFromExpression(block.expression, scope) ];
        }

        return [ new VoidType ];
    }

    return [];
}

export function resolveSymbolType(symbol: CodeSymbol): TypeSignature {
    if (symbol instanceof ClassSymbol) {
        throw new Error("Class reference not yet implemented.");
    } else if (symbol instanceof FieldSymbol) {
        return resolveTypeName(symbol.parent as ScopedSymbol, symbol.expression.type);
    } else if (symbol instanceof MacroSymbol) {
        throw new Error("Macro cannot be used as value.");
    } else if (symbol instanceof ParameterSymbol) {
        if (symbol.expression.typeGuard !== undefined) {
            return resolveTypeName(symbol.parent as ScopedSymbol, symbol.expression.typeGuard);
        }

        if (symbol.expression.defaultValue !== undefined) {
            return inferTypeFromExpression(symbol.expression.defaultValue, symbol.parent as ScopedSymbol /* not a class if it's a parameter */);
        }

        throw new Error("Failed to resolve parameter type");
    } else if (symbol instanceof ProcedureSymbol) {
        const proc = symbol.expression as ProcDeclarationExpression;
        const argTypes = proc.parameters.map(param => {
            if (param.typeGuard !== undefined) {
                return resolveTypeName(symbol.parent!, param.typeGuard);
            }

            if (param.defaultValue !== undefined) {
                return inferTypeFromExpression(param.defaultValue, symbol);
            }
            
            throw new Error("Param requires a type");
        });

        if (proc.returnType !== undefined) {
            return new FunctionSignatureType(argTypes, resolveTypeName(symbol.parent!, proc.returnType));
        }

        const possibleInferredReturnTypes = resolveBlockReturnTypes(proc.block, symbol);
        if (possibleInferredReturnTypes.length > 1)
            throw new Error("Function cannot have multiple return types");

        return new FunctionSignatureType(argTypes, possibleInferredReturnTypes[0]);
    } else if (symbol instanceof VariableSymbol) {
        if (symbol.expression.typeGuard !== undefined) {
            return resolveTypeName(symbol.parent as ScopedSymbol, symbol.expression.typeGuard);
        }

        return inferTypeFromExpression(symbol.expression.initialValue, symbol.parent as ScopedSymbol /* not a class if it's a variable */);
    }

    return new VoidType;
}

export function inferTypeFromExpression(expression: Expression, currentScope: ScopedSymbol|ClassSymbol): TypeSignature {
    if (expression instanceof NumberExpression) {
        return new PrimitiveType("number");
    } else if (expression instanceof StringExpression) {
        return new PrimitiveType("string");
    } else if (expression instanceof StructFieldsExpression) {
        if (!(expression.reference instanceof KeywordExpression))
            throw new Error("Invalid struct");

        const referenceSymbol = currentScope.getIdentifierReference(expression.reference.keyword);
        if (referenceSymbol === undefined || !(referenceSymbol instanceof ClassSymbol)) throw new Error("Invalid reference");

        return new ClassInstanceType(referenceSymbol as ClassSymbol);
    } else if (expression instanceof ParenthesisExpression) {
        const lastExpression = expression.expressions[expression.expressions.length - 1];
        if (lastExpression === undefined) throw new Error("Failed to resolve type");

        return inferTypeFromExpression(lastExpression, currentScope);
    } else if (expression instanceof AssignmentExpression) {
        return inferTypeFromExpression(expression.value, currentScope);
    } else if (expression instanceof FunctionCallExpression) {
        const procSymbol = inferTypeFromExpression(expression.reference, currentScope);
        if (!(procSymbol instanceof FunctionSignatureType))
            throw new Error("Bad function call");

        return procSymbol.returnType;
    } else if (expression instanceof AccessorExpression) {
        const baseClass = inferTypeFromExpression(expression.base, currentScope);
        if (!(baseClass instanceof ClassInstanceType)) throw new Error("Bad access");
        
        const childAccess = baseClass.classSymbol.children.get(expression.property.keyword);
        if (childAccess !== undefined) {
            return resolveSymbolType(childAccess);
        } else {
            throw new Error(`Type '${baseClass.classSymbol.name}' does not have property '${expression.property.keyword}'`);
        }
    } else if (expression instanceof KeywordExpression) {
        const referenceSymbol = currentScope.getIdentifierReference(expression.keyword);
        if (referenceSymbol === undefined) throw new Error("Invalid reference");

        return resolveSymbolType(referenceSymbol);
    } else if (expression instanceof OperatorExpression) {
        const left = inferTypeFromExpression(expression.left, currentScope);
        const right = inferTypeFromExpression(expression.right, currentScope);
        if (!(left instanceof PrimitiveType) || !(right instanceof PrimitiveType)) {
            throw new Error(`Operator '${expression.operator}' cannot be applied to types '${left.getName()}' and '${right.getName()}'`);
        }
        switch (expression.operator) {
        case "+":
            if (left.typeName === "string" || right.typeName === "string")
                return new PrimitiveType("string");

            return new PrimitiveType("number");
        }
    }

    return new VoidType;
}

export function createProjectOutline(block: Expression[], scope: ScopedSymbol, symbols: SymbolDeclarationStore, errors: ErrorCollector) {
    for (const expression of block) {
        if (expression instanceof VariableDeclarationExpression) {
            const varType = inferTypeFromExpression(expression.initialValue, scope);
            console.log(expression.identifier, varType);
        }
    }
}