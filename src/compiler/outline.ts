import { CompilerError, ErrorCode } from "../error";
import { ErrorCollector } from "../errorCollector";
import { AccessorExpression, AssignmentExpression, Expression, FunctionCallExpression, IfStatementExpression, KeywordExpression, MacroDeclarationExpression, NumberExpression, OperatorExpression, ParenthesisExpression, ProcDeclarationExpression, ReturnStatementExpression, StringExpression, StructFieldsExpression, VariableDeclarationExpression, WhileStatementExpression } from "../expression";
import { ClassSymbol, CodeSymbol, FieldSymbol, MacroSymbol, ParameterSymbol, ProcedureSymbol, ScopedSymbol, VariableSymbol } from "./definitions";
import { SymbolDeclarationStore } from "./symbolDeclarationStore";

export abstract class TypeSignature {
    abstract getName(): string;
}

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

export class FunctionType extends TypeSignature {
    constructor(public readonly typeReference: Expression, public readonly params: TypeSignature[], public readonly returnType: TypeSignature) { super(); }

    getName(): string {
        return "proc(" + this.params.map(arg => arg.getName()).join(", ") + "): " + this.returnType.getName();
    }
}

export class VoidType extends TypeSignature {
    getName(): string {
        return "void";
    }
}

const PRIMITIVE_TYPES: Map<string, PrimitiveType> = new Map([
    [ "number", new PrimitiveType("number") ],
    [ "string", new PrimitiveType("string") ]  
]);

const VOID_TYPE = new VoidType;

export function resolveTypeName(
    scope: ScopedSymbol|ClassSymbol,
    type: ProcDeclarationExpression|KeywordExpression,
    existingTypes: Map<CodeSymbol, TypeSignature>,
    compilerErrors: ErrorCollector
): TypeSignature {
    if (type instanceof ProcDeclarationExpression) {
        if (!type.isTypeDeclaration())
            return VOID_TYPE;

        const argTypes = type.parameters.map(param => {
            if (param.type !== undefined) {
                return resolveTypeName(scope, param.type, existingTypes, compilerErrors);
            }

            throw new Error("Param requires a type");
        });

        return new FunctionType(type, argTypes, resolveTypeName(scope, type.returnType, existingTypes, compilerErrors));
    }

    const primitiveType = PRIMITIVE_TYPES.get(type.keyword);
    if (primitiveType !== undefined)
        return primitiveType;

    if (type.keyword === "void") return VOID_TYPE;

    const typeSymbol = scope.getIdentifierReference(type.keyword);
    if (typeSymbol === undefined || !(typeSymbol instanceof ClassSymbol)) throw new Error(`Invalid type reference '${type}'`);

    return getOrCreateExistingType(typeSymbol, new ClassInstanceType(typeSymbol), existingTypes);
}

export function resolveBlockReturnTypes(block: Expression, scope: ScopedSymbol|ClassSymbol, existingTypes: Map<CodeSymbol, TypeSignature>, compilerErrors: ErrorCollector): TypeSignature[] {
    if (block instanceof ParenthesisExpression) {
        const types = [];
        for (const expression of block.expressions) {
            if (expression instanceof ReturnStatementExpression) {
                if (expression.expression !== undefined) {
                    types.push(inferTypeFromExpression(expression.expression, scope, existingTypes, compilerErrors));
                } else {
                    types.push(VOID_TYPE);
                }
                break;
            } else if (expression instanceof IfStatementExpression) {
                types.push(...resolveBlockReturnTypes(expression.block, scope, existingTypes, compilerErrors));
                if (expression.elseBlock !== undefined) types.push(...resolveBlockReturnTypes(expression.elseBlock, scope, existingTypes, compilerErrors));
            } else if (expression instanceof WhileStatementExpression) {
                types.push(...resolveBlockReturnTypes(expression.block, scope, existingTypes, compilerErrors));
            }
        }
        return types.length > 0 ? types : [ VOID_TYPE ];
    } else if (block instanceof ReturnStatementExpression) {
        if (block.expression !== undefined) {
            return [ inferTypeFromExpression(block.expression, scope, existingTypes, compilerErrors) ];
        }

        return [ VOID_TYPE ];
    }

    return [ VOID_TYPE ];
}

export function resolveSymbolType(symbol: CodeSymbol, existingTypes: Map<CodeSymbol, TypeSignature>, compilerErrors: ErrorCollector): TypeSignature {
    const existingType = existingTypes.get(symbol);
    if (existingType !== undefined) return existingType;
    
    if (symbol instanceof ClassSymbol) {
        throw new Error("Class reference not yet implemented.");
    } else if (symbol instanceof FieldSymbol) {
        return resolveTypeName(symbol.parent as ScopedSymbol, symbol.expression.type, existingTypes, compilerErrors);
    } else if (symbol instanceof MacroSymbol) {
        throw new Error("Macro cannot be used as value.");
    } else if (symbol instanceof ParameterSymbol) {
        if (symbol.expression.type !== undefined) {
            return resolveTypeName(symbol.parent as ScopedSymbol, symbol.expression.type, existingTypes, compilerErrors);
        }

        if (symbol.expression.defaultValue !== undefined) {
            return inferTypeFromExpression(symbol.expression.defaultValue, symbol.parent as ScopedSymbol /* not a class if it's a parameter */, existingTypes, compilerErrors);
        }

        throw new Error("Failed to resolve parameter type");
    } else if (symbol instanceof ProcedureSymbol) {
        const proc = symbol.expression as ProcDeclarationExpression;

        if (!proc.isCodeDefinition())
            return VOID_TYPE;

        const argTypes = proc.parameters.map(param => {
            if (param.type !== undefined) {
                return resolveTypeName(symbol.parent!, param.type, existingTypes, compilerErrors);
            }

            if (param.defaultValue !== undefined) {
                return inferTypeFromExpression(param.defaultValue, symbol, existingTypes, compilerErrors);
            }
            
            throw new Error("Param requires a type");
        });

        if (proc.returnType !== undefined) {
            return new FunctionType(symbol.expression, argTypes, resolveTypeName(symbol.parent!, proc.returnType, existingTypes, compilerErrors));
        }

        const possibleInferredReturnTypes = resolveBlockReturnTypes(proc.block, symbol, existingTypes, compilerErrors);
        if (possibleInferredReturnTypes.length > 1)
            throw new Error("Function cannot have multiple return types");

        return new FunctionType(symbol.expression, argTypes, possibleInferredReturnTypes[0]);
    } else if (symbol instanceof VariableSymbol) {
        if (symbol.expression.type !== undefined) {
            return resolveTypeName(symbol.parent as ScopedSymbol, symbol.expression.type, existingTypes, compilerErrors);
        }

        return inferTypeFromExpression(symbol.expression.initialValue, symbol.parent as ScopedSymbol /* not a class if it's a variable */, existingTypes, compilerErrors);
    }

    return VOID_TYPE;
}

export function compareTypeSignatures(a: TypeSignature, b: TypeSignature) {
    if (a instanceof PrimitiveType) {
        return a === b;
    } else if (a instanceof ClassInstanceType) {
        return a === b;
    } else if (a instanceof FunctionType) {
        if (!(b instanceof FunctionType)) return false;

        if (!compareTypeSignatures(a.returnType, b.returnType)) return false;

        if (a.params.length !== b.params.length) return false;

        for (let i = 0; i < a.params.length; i++) {
            if (!compareTypeSignatures(a.params[i], b.params[i])) return false;
        }
        return true;
    } else if (a instanceof VoidType) {
        return a === b;
    }
    return false;
}

export function getOrCreateExistingType(symbol: CodeSymbol, type: TypeSignature, existingTypes: Map<CodeSymbol, TypeSignature>) {
    const existingType = existingTypes.get(symbol);
    if (existingType !== undefined) return existingType;

    existingTypes.set(symbol, type);
    return type;
}

export function inferTypeFromExpression(expression: Expression, currentScope: ScopedSymbol|ClassSymbol, existingTypes: Map<CodeSymbol, TypeSignature>, compilerErrors: ErrorCollector): TypeSignature {
    if (expression instanceof NumberExpression) {
        return PRIMITIVE_TYPES.get("number")!;
    } else if (expression instanceof StringExpression) {
        return PRIMITIVE_TYPES.get("string")!;
} else if (expression instanceof StructFieldsExpression) {
        if (!(expression.reference instanceof KeywordExpression))
            throw new Error("Invalid struct");

        const referenceSymbol = currentScope.getIdentifierReference(expression.reference.keyword);
        if (referenceSymbol === undefined || !(referenceSymbol instanceof ClassSymbol)) throw new Error("Invalid reference");

        return getOrCreateExistingType(referenceSymbol, new ClassInstanceType(referenceSymbol as ClassSymbol), existingTypes);
    } else if (expression instanceof ParenthesisExpression) {
        const lastExpression = expression.expressions[expression.expressions.length - 1];
        if (lastExpression === undefined) throw new Error("Failed to resolve type");

        return inferTypeFromExpression(lastExpression, currentScope, existingTypes, compilerErrors);
    } else if (expression instanceof AssignmentExpression) {
        return inferTypeFromExpression(expression.value, currentScope, existingTypes, compilerErrors);
    } else if (expression instanceof FunctionCallExpression) {
        if (expression.reference instanceof KeywordExpression) {
            const refSymbol = currentScope.getIdentifierReference(expression.reference.keyword);
            if (refSymbol instanceof MacroSymbol) {
                const proc = refSymbol.expression as MacroDeclarationExpression;
                const argTypes = proc.parameters.map(param => {
                    if (param.type !== undefined) {
                        return resolveTypeName(refSymbol.parent!, param.type, existingTypes, compilerErrors);
                    }

                    if (param.defaultValue !== undefined) {
                        return inferTypeFromExpression(param.defaultValue, refSymbol, existingTypes, compilerErrors);
                    }
                    
                    throw new Error("Param requires a type");
                });

                return inferTypeFromExpression(proc.block, refSymbol, existingTypes, compilerErrors);
            }
        }

        const procSignature = inferTypeFromExpression(expression.reference, currentScope, existingTypes, compilerErrors);
        if (!(procSignature instanceof FunctionType))
            throw new Error("Bad function call");

        if (expression.args.length !== procSignature.params.length) {
            compilerErrors.addError(
                new CompilerError(ErrorCode.BadFunctioncall)
                    .addError(expression.position, "Bad function call")
                    .addInfo(procSignature.typeReference.position, `Function signature '${procSignature.getName()}' expects ${procSignature.params.length} \
argument${procSignature.params.length === 1 ? "" : "s"} whereas only ${expression.args.length} ${expression.args.length === 1 ? "is" : "are"} provided`)
            );
            return procSignature.returnType;
        }

        for (let i = 0; i < expression.args.length; i++) {
            const inferredArgumentType = inferTypeFromExpression(expression.args[i], currentScope, existingTypes, compilerErrors);
            if (!compareTypeSignatures(inferredArgumentType, procSignature.params[i])) {
                compilerErrors.addError(
                    new CompilerError(ErrorCode.BadFunctioncall)
                        .addError(expression.position, "Bad function call")
                        .addInfo(procSignature.typeReference.position, `Type of '${inferredArgumentType.getName()}' is not assignable to type '${procSignature.params[i].getName()}' \
in argument ${i + 1} for function signature '${procSignature.getName()}'`)
                );
            }
        }

        return procSignature.returnType;
    } else if (expression instanceof AccessorExpression) {
        const baseClass = inferTypeFromExpression(expression.base, currentScope, existingTypes, compilerErrors);
        if (!(baseClass instanceof ClassInstanceType)) throw new Error("Bad access");
        
        const childAccess = baseClass.classSymbol.children.get(expression.property.keyword);
        if (childAccess !== undefined) {
            return resolveSymbolType(childAccess, existingTypes, compilerErrors);
        } else {
            throw new Error(`Type '${baseClass.classSymbol.name}' does not have property '${expression.property.keyword}'`);
        }
    } else if (expression instanceof KeywordExpression) {
        const referenceSymbol = currentScope.getIdentifierReference(expression.keyword);
        if (referenceSymbol === undefined) throw new Error("Invalid reference");

        return resolveSymbolType(referenceSymbol, existingTypes, compilerErrors);
    } else if (expression instanceof OperatorExpression) {
        const left = inferTypeFromExpression(expression.left, currentScope, existingTypes, compilerErrors);
        const right = inferTypeFromExpression(expression.right, currentScope, existingTypes, compilerErrors);
        if (!(left instanceof PrimitiveType) || !(right instanceof PrimitiveType)) {
            throw new Error(`Operator '${expression.operator}' cannot be applied to types '${left.getName()}' and '${right.getName()}'`);
        }
        switch (expression.operator) {
        case "+":
            if (left.typeName === "string" || right.typeName === "string")
                return PRIMITIVE_TYPES.get("string")!;

            return PRIMITIVE_TYPES.get("number")!;
        }
    }

    return VOID_TYPE;
}

export function createProjectOutline(block: Expression[], scope: ScopedSymbol, symbols: SymbolDeclarationStore, compilerErrors: ErrorCollector) {
    const existingTypes: Map<CodeSymbol, TypeSignature> = new Map;
    for (const expression of block) {
        if (expression instanceof VariableDeclarationExpression) {
            const varType = inferTypeFromExpression(expression.initialValue, scope, existingTypes, compilerErrors);
            if (expression.type !== undefined) {
                const symbolType = resolveTypeName(scope, expression.type, existingTypes, compilerErrors);
                if (symbolType !== varType) {
                    compilerErrors.addError(
                        new CompilerError(ErrorCode.BadTypeAssignment)
                            .addError(expression.position, "Invalid assignment")
                            .addInfo(expression.initialValue.position, `Type '${varType.getName()}' is not assignable to type '${symbolType.getName()}'`)
                    );
                    return;
                }
            }
            console.log(expression.identifier, varType);
        }
    }
}