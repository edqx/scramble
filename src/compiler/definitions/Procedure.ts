import { ErrorCollector } from "../../errorCollector";
import { AccessorExpression, AssignmentExpression, Expression, FunctionCallExpression, KeywordExpression, NumberExpression, ParenthesisExpression, ProcDeclarationExpression, ReturnStatementExpression, ScriptExpression, StringExpression, StructFieldsExpression, VariableDeclarationExpression } from "../../expression";
import { Block, BlockRef, BroadcastDefinition, BroadcastValue, ListDefinition, NumberValue, Shadowed, StringValue, Value, ValueType, VariableDefinition, VariableValue } from "../../scratch";
import { ExistingTypes } from "../ExistingTypes";
import { IdGenerator } from "../IdGenerator";
import { Sprite, Stack } from "../../scratch/Sprite";
import { staticallyAnalyseExpressionDeclaration } from "../analysis";
import { inferExpressionType } from "../inferExpressionType";
import { getProcedureSignature, resolveSymbolType } from "../resolveSymbolType";
import { SymbolDeclarationStore } from "../symbolDeclarationStore";
import { ClassInstanceType, ProcedureSignatureType, Type, VoidType } from "../types";
import { ClassSymbol } from "./Class";
import { MacroSymbol } from "./Macro";
import { ParameterSymbol } from "./Parameter";
import { ScopedSymbol, SymbolFlag, SymbolType } from "./Symbol";
import { VariableSymbol } from "./Variable";

export class ParameterDefinition {
    constructor(public readonly name: string, public readonly block: Block) {}
}

export class SubListDefinition {
    constructor(public readonly list: ListDefinition, public readonly sliceStart: number, public readonly sliceSize: number) {}
}

export type PossibleParameterRedefinition = VariableDefinition|ListDefinition|ParameterDefinition|ParameterDefinition[];
export type PossibleReference = Stack|Value|VariableDefinition|ListDefinition|SubListDefinition|ParameterDefinition|ParameterDefinition[]|undefined;

export class ProcedureSymbol extends ScopedSymbol<ProcDeclarationExpression|ScriptExpression> {
    static analyseDeclaration(
        parentScope: ProcedureSymbol|MacroSymbol|ClassSymbol,
        expression: ProcDeclarationExpression,
        symbols: SymbolDeclarationStore,
        errorCollector: ErrorCollector
    ) {
        if (parentScope instanceof MacroSymbol) throw new Error("Cannot declare procedure in macro");

        if (!expression.isCodeDefinition()) return;
        
        const error = parentScope.getErrorNotTaken(expression, expression.identifier);
        if (error) return errorCollector.addError(error);

        const proc = symbols.addProcedure(expression, parentScope);
        for (const parameterDeclarationExpression of expression.parameters) {
            ParameterSymbol.analyseDeclaration(proc, parameterDeclarationExpression, symbols, errorCollector);
        }
        if (expression.block instanceof ParenthesisExpression) {
            for (const expr of expression.block.expressions) {
                staticallyAnalyseExpressionDeclaration(proc, expr, symbols, errorCollector);
            }
        } else {
            staticallyAnalyseExpressionDeclaration(proc, expression.block, symbols, errorCollector);
        }
    }
    
    protected _cachedReturnVariable: ListDefinition|VariableDefinition|undefined;
    protected _cachedParameterIds: string[]|undefined;
    protected _cachedBroadcastProxy: BroadcastDefinition|undefined;
    protected _cachedBroadcastProxyParams: ListDefinition|undefined;

    constructor(id: string, parent: ProcedureSymbol|ClassSymbol|undefined, name: string, expression: ProcDeclarationExpression|ScriptExpression) {
        super(id, parent, SymbolType.Procedure, name, expression);

        this.flags.add(SymbolFlag.Hoisted);
    }

    getReturnValueReference(uniqueIds: IdGenerator, existingTypes: ExistingTypes, errorCollector: ErrorCollector, sprite: Sprite) {
        if (this._cachedReturnVariable !== undefined) return this._cachedReturnVariable;

        const typeSignature = getProcedureSignature(this, existingTypes, errorCollector);
        if (typeSignature.size > 1) {
            const list = sprite.createList(uniqueIds.nextId(), "<-" + this.name);
            this._cachedReturnVariable = list;
            return list;
        } else {
            const variable = sprite.createVariable(uniqueIds.nextId(), "<-" + this.name);
            this._cachedReturnVariable = variable;
            return variable;
        }
    }

    getParameterIds(uniqueIds: IdGenerator, existingTypes: ExistingTypes, errorCollector: ErrorCollector) {
        if (this._cachedParameterIds !== undefined) return this._cachedParameterIds;

        this._cachedParameterIds = [];
        const signature = getProcedureSignature(this, existingTypes, errorCollector);
        for (const param of signature.params) {
            for (let i = 0; i < param.type.size; i++) {
                this._cachedParameterIds.push(uniqueIds.nextId());
            }
        }

        return this._cachedParameterIds;
    }

    getProcCode(uniqueIds: IdGenerator, existingTypes: ExistingTypes, errorCollector: ErrorCollector) {
        const signature = getProcedureSignature(this, existingTypes, errorCollector);
        const parameterIds = this.getParameterIds(uniqueIds, existingTypes, errorCollector);
        if (parameterIds.length === 0) return signature.functionSymbol!.name;

        return signature.functionSymbol!.name + " " + parameterIds.map(param => "%s").join(" ");
    }

    getBroadcastProxyReference(uniqueIds: IdGenerator, existingTypes: ExistingTypes, sprite: Sprite, errorCollector: ErrorCollector) {
        if (this._cachedBroadcastProxy !== undefined) return this._cachedBroadcastProxy;

        const signature = getProcedureSignature(this, existingTypes, errorCollector);
        this._cachedBroadcastProxy = sprite.createBroadcast(uniqueIds.nextId(), "@" + signature.functionSymbol!.name);
        return this._cachedBroadcastProxy;
    }

    getBroadcastProxyParamsReference(uniqueIds: IdGenerator, existingTypes: ExistingTypes, sprite: Sprite, errorCollector: ErrorCollector) {
        if (this._cachedBroadcastProxyParams !== undefined) return this._cachedBroadcastProxyParams;

        const signature = getProcedureSignature(this, existingTypes, errorCollector);
        this._cachedBroadcastProxyParams = sprite.createList(uniqueIds.nextId(), "@" + signature.functionSymbol!.name + "#args");
        return this._cachedBroadcastProxyParams;
    }

    createParameterBlock(uniqueIds: IdGenerator, name: string) {
        return new Block(
            uniqueIds.nextId(),
            "argument_reporter_string_number",
            {},
            {
                VALUE: [ name, null ]
            },
            true,
            false
        )
    }

    createParameterReferenceBlock(uniqueIds: IdGenerator, name: string) {
        return new Block(
            uniqueIds.nextId(),
            "argument_reporter_string_number",
            {},
            {
                VALUE: [ name, null ]
            },
            true,
            false
        );
    }

    createParameterDefinition(uniqueIds: IdGenerator, name: string) {
        return new ParameterDefinition(name, this.createParameterReferenceBlock(uniqueIds, name));
    }

    createIntermediateParamList(uniqueIds: IdGenerator, listName: string, params: ParameterDefinition[], stack: Stack) {
        const list = stack.sprite.createList(uniqueIds.nextId(), listName);
        stack.orderedStackBlocks.push(
            new Block(
                uniqueIds.nextId(),
                "data_deletealloflist",
                {},
                {
                    LIST: [ list.name, list.id ]
                }
            )
        );
        for (const param of params) {
            const paramRefBlock = this.createParameterReferenceBlock(uniqueIds, param.name);
            stack.subBlocks.push(paramRefBlock);
            const addFieldToList = new Block(
                uniqueIds.nextId(),
                "data_addtolist",
                { ITEM: new Shadowed(undefined, new BlockRef(paramRefBlock)) },
                { LIST: [ list.name, list.id ] }
            );
            stack.orderedStackBlocks.push(addFieldToList);
        }
        return list;
    }

    createIntermediateParamVariable(uniqueIds: IdGenerator, varName: string, param: ParameterDefinition, stack: Stack) {
        const paramRefBlock = this.createParameterReferenceBlock(uniqueIds, param.name);
        stack.subBlocks.push(paramRefBlock);
        const variable = stack.sprite.createVariable(uniqueIds.nextId(), varName);
        const setVarTo = new Block(
            uniqueIds.nextId(),
            "data_setvariableto",
            { VALUE: new Shadowed(undefined, new BlockRef(paramRefBlock)) },
            { VARIABLE: [ variable.name, variable.id ] }
        );
        stack.orderedStackBlocks.push(setVarTo);
        return variable;
    }

    expandProcedureParameters(uniqueIds: IdGenerator, structPathName: string, parameterType: ClassInstanceType, existingTypes: ExistingTypes, errorCollector: ErrorCollector): ParameterDefinition[] {
        const parameterDefinitions = [];
        for (const [ , field ] of parameterType.fields) {
            const parameterName = structPathName + "_" + field.fieldSymbol.name;
            if (field.type instanceof ClassInstanceType) {
                parameterDefinitions.push(...this.expandProcedureParameters(uniqueIds, parameterName, field.type, existingTypes, errorCollector));
            } else {
                parameterDefinitions.push(this.createParameterDefinition(uniqueIds, parameterName));
            }
        }
        return parameterDefinitions;
    }

    createProcedurePrototypeBlock(uniqueIds: IdGenerator, parameterIds: string[], parameterDefinitions: ParameterDefinition[], existingTypes: ExistingTypes, errorCollector: ErrorCollector) {
        return new Block(
            uniqueIds.nextId(),
            "procedures_prototype",
            Object.fromEntries(
                parameterIds.map((id, i) => {
                    return [ id, new Shadowed(undefined, new BlockRef(parameterDefinitions[i].block)) ];
                })
            ),
            { },
            true, false,
            {
                tagName: "mutation",
                children: [],
                proccode: this.getProcCode(uniqueIds, existingTypes, errorCollector),
                argumentids: JSON.stringify(parameterIds),
                argumentnames: JSON.stringify(parameterDefinitions.map(x => x.name)),
                argumentdefaults: JSON.stringify(parameterIds.map(() => "")),
                warp: "true" 
            }
        )
    }

    createProcedureDefinitionBlock(uniqueIds: IdGenerator, procedurePrototype: Block) {
        return new Block(
            uniqueIds.nextId(),
            "procedures_definition",
            { custom_block: new Shadowed(undefined, new BlockRef(procedurePrototype)) },
            { },
            false, true
        );
    }

    createProcedureCallBlock(uniqueIds: IdGenerator, procCode: string, parameterIds: string[], parameters: (Value|BlockRef)[]) {
        return new Block(
            uniqueIds.nextId(),
            "procedures_call",
            Object.fromEntries(parameterIds.map((parameterId, i) => {
                const parameterAccess = parameters[i];
                if (parameterAccess === undefined) throw new Error(`Missing parameter ${i}`);
                return [ parameterId, new Shadowed(undefined, parameterAccess) ]
            })),
            { },
            false,
            false,
            {
                tagName: "mutation",
                children: [],
                proccode: procCode,
                argumentids: JSON.stringify(parameterIds),
                warp: "true"
            }
        );
    }

    recursiveArgumentsCreateReferenceBlocks(
        uniqueIds: IdGenerator,
        argumentTypes: Type[],
        argumentReferences: (Value|ListDefinition|VariableDefinition|SubListDefinition|ParameterDefinition|ParameterDefinition[])[],
        argumentReferenceBlocks: (Value|BlockRef)[],
        stack: Stack
    ) {
        for (let i = 0; i < argumentReferences.length; i++) {
            const argumentReference = argumentReferences[i];
            const argumentType = argumentTypes[i];
            if (Array.isArray(argumentReference)) {
                if (!(argumentType instanceof ClassInstanceType)) throw new Error("Failed assertion");
                let i = 0;
                for (const [ , field ] of argumentType.fields) {
                    if (field.type instanceof ClassInstanceType) {
                        const fieldTypes = [...field.type.fields.values()].map(fieldType => fieldType.type);
                        this.recursiveArgumentsCreateReferenceBlocks(uniqueIds, fieldTypes, argumentReference.slice(i, field.type.size), argumentReferenceBlocks, stack);
                    } else {
                        this.recursiveArgumentsCreateReferenceBlocks(uniqueIds, [ field.type ], [ argumentReference[i] ], argumentReferenceBlocks, stack);
                    }

                    i += field.type.size;
                }
            } else if (argumentReference instanceof ParameterDefinition) {
                const block = this.createParameterReferenceBlock(uniqueIds, argumentReference.name);
                stack.subBlocks.push(block);
                argumentReferenceBlocks.push(new BlockRef(block));
            } else if (argumentReference instanceof SubListDefinition || argumentReference instanceof ListDefinition) {
                if (!(argumentType instanceof ClassInstanceType)) throw new Error("Failed assertion");
                let i = 0;
                for (const [ , field ] of argumentType.fields) {
                    if (field.type instanceof ClassInstanceType) {
                        this.recursiveArgumentsCreateReferenceBlocks(
                            uniqueIds,
                            [ field.type ],
                            argumentReference instanceof SubListDefinition
                                ? [ new SubListDefinition(argumentReference.list, argumentReference.sliceSize + i, field.type.size) ]
                                : [ new SubListDefinition(argumentReference, i, field.type.size) ],
                            argumentReferenceBlocks,
                            stack
                        );
                    } else {
                        if (argumentReference instanceof SubListDefinition) {
                            const listItemReference = new Block(
                                uniqueIds.nextId(),
                                "data_itemoflist",
                                { INDEX: new Shadowed(undefined, new NumberValue(argumentReference.sliceSize + 1)) },
                                { LIST: [ argumentReference.list.name, argumentReference.list.id ] }
                            );
                            stack.subBlocks.push(listItemReference);
                            argumentReferenceBlocks.push(new BlockRef(listItemReference));
                        } else {
                            const listItemReference = new Block(
                                uniqueIds.nextId(),
                                "data_itemoflist",
                                { INDEX: new Shadowed(undefined, new NumberValue(1)) },
                                { LIST: [ argumentReference.name, argumentReference.id ] }
                            );
                            stack.subBlocks.push(listItemReference);
                            argumentReferenceBlocks.push(new BlockRef(listItemReference));
                        }
                    }

                    i += field.type.size;
                }
            } else if (argumentReference instanceof VariableDefinition) {
                argumentReferenceBlocks.push(new VariableValue(argumentReference.name, argumentReference.id));
            } else if (argumentReference instanceof Value) {
                argumentReferenceBlocks.push(argumentReference);
            }
        }
    }

    generateProcedureBroadcastProxyBlocksForSprite(uniqueIds: IdGenerator, parameterIds: string[], existingTypes: ExistingTypes, stack: Stack, errorCollector: ErrorCollector) {
        const broadcastProxyReference = this.getBroadcastProxyReference(uniqueIds, existingTypes, stack.sprite, errorCollector);
        const broadcastProxyParamsReference = this.getBroadcastProxyParamsReference(uniqueIds, existingTypes, stack.sprite, errorCollector);
        const broadcastHat = new Block(
            uniqueIds.nextId(),
            "event_whenbroadcastreceived",
            { },
            { BROADCAST_OPTION: [ broadcastProxyReference.id, broadcastProxyReference.name ] },
            false,
            true
        );
        const procCode = this.getProcCode(uniqueIds, existingTypes, errorCollector);
        const proxyParameterAccesses: BlockRef[] = [];
        for (let index = 0; index < parameterIds.length; index++) {
            const listItemReference = new Block(
                uniqueIds.nextId(),
                "data_itemoflist",
                { INDEX: new Shadowed(undefined, new NumberValue(index + 1)) },
                { LIST: [ broadcastProxyParamsReference.name, broadcastProxyParamsReference.id ] }
            );
            proxyParameterAccesses.push(new BlockRef(listItemReference));
        }
        const procedureCall = this.createProcedureCallBlock(uniqueIds, procCode, parameterIds, proxyParameterAccesses);
        for (const parameterAccess of proxyParameterAccesses) {
            parameterAccess.block.setParentId(procedureCall.id);
            stack.subBlocks.push(parameterAccess.block);
        }
        stack.orderedStackBlocks.push(procedureCall);
        stack.sprite.applyStack(stack, broadcastHat);
    }

    getStructFieldInitializationVectorAtOffset(structType: ClassInstanceType, structInitialization: StructFieldsExpression, offset: number) {
        const fieldAtIndex = [...structType.fields.values()].find(field => field.offset === offset);
        if (fieldAtIndex === undefined) return undefined;
        const initializationField = structInitialization.assignments.find(assignment => assignment.reference instanceof KeywordExpression && assignment.reference.keyword === fieldAtIndex.fieldSymbol.name);
        if (initializationField === undefined) return undefined;

        return initializationField.value;
    }

    protected createStructValueReference(
        uniqueIds: IdGenerator,
        from: ListDefinition|ParameterDefinition[]|StructFieldsExpression|SubListDefinition,
        fieldName: string,
        initialOffset: number,
        index: number,
        type: ClassInstanceType,
        parameterVariables: Map<ParameterSymbol, PossibleParameterRedefinition>,
        existingTypes: ExistingTypes,
        stack: Stack,
        errorCollector: ErrorCollector
    ) {
        if (Array.isArray(from)) {
            const parameterReference = this.createParameterReferenceBlock(uniqueIds, from[index].name);
            return new BlockRef(parameterReference);
        } else if (from instanceof StructFieldsExpression) {
            const initializationFieldValue = this.getStructFieldInitializationVectorAtOffset(type, from, index - initialOffset);
            if (initializationFieldValue === undefined) throw new Error(`Struct field not initialized: '${fieldName}'`);
            if (initializationFieldValue instanceof StructFieldsExpression) {
                throw new Error("Cannot convert struct to value reference, this should not happening");
            } else {
                const value = this.generateBlocksForCodeBlock(uniqueIds, initializationFieldValue, parameterVariables, existingTypes, stack, errorCollector);
                if (value instanceof ListDefinition || Array.isArray(value)) {
                    throw new Error("Cannot convert struct to value reference, this should not happening");
                } else {
                    if (value instanceof Value) return value;
                    if (value instanceof Stack) throw new Error("Cannot convert block stack to value reference");
                    if (value instanceof ParameterDefinition) return new BlockRef(value.block);
                    if (value instanceof VariableDefinition) return new VariableValue(value.name, value.id);

                    throw new Error("Invalid value reference");
                }
            }
        } else if (from instanceof ListDefinition) {
            const listItemReference = new Block(
                uniqueIds.nextId(),
                "data_itemoflist",
                { INDEX: new Shadowed(undefined, new NumberValue(index + 1)) },
                { LIST: [ from.name, from.id ] }
            );
            return new BlockRef(listItemReference);
        } else if (from instanceof SubListDefinition) {
            const listItemReference = new Block(
                uniqueIds.nextId(),
                "data_itemoflist",
                { INDEX: new Shadowed(undefined, new NumberValue(from.sliceSize + index + 1)) },
                { LIST: [ from.list.name, from.list.id ] }
            );
            return new BlockRef(listItemReference);
        }
    }

    protected recursiveGenerateCopyStructValuesBlocksImpl(
        uniqueIds: IdGenerator,
        index: number,
        from: ListDefinition|SubListDefinition|ParameterDefinition[]|StructFieldsExpression,
        to: ListDefinition|SubListDefinition,
        type: ClassInstanceType,
        parameterVariables: Map<ParameterSymbol, PossibleParameterRedefinition>,
        existingTypes: ExistingTypes,
        stack: Stack,
        errorCollector: ErrorCollector
    ) {
        let initialOffset = index;
        for (const [ , field ] of type.fields) {
            if (field.type instanceof ClassInstanceType) {
                if (from instanceof StructFieldsExpression) {
                    const initializationFieldValue = this.getStructFieldInitializationVectorAtOffset(type, from, index - initialOffset);
                    if (initializationFieldValue === undefined) throw new Error(`Struct field not initialized: '${field.fieldSymbol.name}'`);
                    if (initializationFieldValue instanceof StructFieldsExpression) {
                        this.recursiveGenerateCopyStructValuesBlocksImpl(uniqueIds, index, initializationFieldValue, to, field.type, parameterVariables, existingTypes, stack, errorCollector);
                    } else {
                        const value = this.generateBlocksForCodeBlock(uniqueIds, initializationFieldValue, parameterVariables, existingTypes, stack, errorCollector)
                        if (value instanceof ListDefinition || Array.isArray(value)) {
                            this.recursiveGenerateCopyStructValuesBlocksImpl(uniqueIds, index, value, to, field.type, parameterVariables, existingTypes, stack, errorCollector);
                        } else {
                            throw new Error("Bad assignment for type in struct field");
                        }
                    }
                } else {
                    this.recursiveGenerateCopyStructValuesBlocksImpl(uniqueIds, index, from, to, field.type, parameterVariables, existingTypes, stack, errorCollector);
                }
                index += field.type.size;
                continue;
            }

            const fieldReference = this.createStructValueReference(uniqueIds, from, field.fieldSymbol.name, initialOffset, index, type, parameterVariables, existingTypes, stack, errorCollector);
            if (to instanceof SubListDefinition) {
                const insertFieldToList = new Block(
                    uniqueIds.nextId(),
                    "data_insertatlist",
                    {
                        ITEM: new Shadowed(undefined, fieldReference),
                        INDEX: new Shadowed(undefined, new NumberValue(to.sliceStart + index + 1 /* scratch indexes start at 1 */))
                    },
                    { LIST: [ to.list.name, to.list.id ] }
                );
                if (fieldReference instanceof BlockRef) {
                    fieldReference.block.setParentId(insertFieldToList.id);
                    stack.subBlocks.push(fieldReference.block);
                }
                stack.orderedStackBlocks.push(insertFieldToList);
            } else {
                const addFieldToList = new Block(
                    uniqueIds.nextId(),
                    "data_addtolist",
                    { ITEM: new Shadowed(undefined, fieldReference) },
                    { LIST: [ to.name, to.id ] }
                );
                if (fieldReference instanceof BlockRef) {
                    fieldReference.block.setParentId(addFieldToList.id);
                    stack.subBlocks.push(fieldReference.block);
                }
                stack.orderedStackBlocks.push(addFieldToList);
            }
            index++;
        }
    }

    createSingleStructValueReference(
        uniqueIds: IdGenerator,
        from: Value|VariableDefinition|ListDefinition|SubListDefinition|ParameterDefinition|ParameterDefinition[]
    ) {
        if (from instanceof Value) return from;
        if (from instanceof ParameterDefinition) {
            const paramRefBlock = this.createParameterReferenceBlock(uniqueIds, from.name);
            return new BlockRef(paramRefBlock);
        }
        if (Array.isArray(from)) {
            const paramRefBlock = this.createParameterReferenceBlock(uniqueIds, from[0].name);
            return new BlockRef(paramRefBlock);
        }
        if (from instanceof VariableDefinition) return new VariableValue(from.name, from.id);
        if (from instanceof ListDefinition) {
            const listItemReference = new Block(
                uniqueIds.nextId(),
                "data_itemoflist",
                { INDEX: new Shadowed(undefined, new NumberValue(1)) },
                { LIST: [ from.name, from.id ] }
            );
            return new BlockRef(listItemReference);
        }
        if (from instanceof SubListDefinition) {
            const listItemReference = new Block(
                uniqueIds.nextId(),
                "data_itemoflist",
                { INDEX: new Shadowed(undefined, new NumberValue(from.sliceStart + 1)) },
                { LIST: [ from.list.name, from.list.id ] }
            );
            return new BlockRef(listItemReference);
        }
    }

    generateReplaceSingleList(
        uniqueIds: IdGenerator,
        from: Value|VariableDefinition|ListDefinition|SubListDefinition|ParameterDefinition|ParameterDefinition[],
        to: ListDefinition|SubListDefinition,
        stack: Stack,
    ) {
        const reference = this.createSingleStructValueReference(uniqueIds, from,);
        const replaceFieldInList = new Block(
            uniqueIds.nextId(),
            "data_replaceitemoflist",
            {
                INDEX: new Shadowed(undefined, to instanceof ListDefinition ? new NumberValue(1) : new NumberValue(to.sliceStart + 1 /* scratch lists start at 1 */)),
                ITEM: new Shadowed(undefined, reference)
            },
            { LIST: to instanceof ListDefinition ? [ to.name, to.id ] : [ to.list.name, to.list.id ] }
        );

        if (reference instanceof BlockRef) {
            reference.block.setParentId(replaceFieldInList.id);
            stack.subBlocks.push(reference.block);
        }
        stack.orderedStackBlocks.push(replaceFieldInList);
    }

    generateSetSingleVariable(
        uniqueIds: IdGenerator,
        from: Value|VariableDefinition|ListDefinition|SubListDefinition|ParameterDefinition|ParameterDefinition[],
        to: VariableDefinition,
        stack: Stack,
    ) {
        const reference = this.createSingleStructValueReference(uniqueIds, from,);
        const setVariableTo = new Block(
            uniqueIds.nextId(),
            "data_setvariableto",
            { VALUE: new Shadowed(undefined, reference) },
            { VARIABLE: [ to.name, to.id ] }
        );

        if (reference instanceof BlockRef) {
            if (reference.block.parentId === undefined) { // we re-use the parameter definition reporter block, so it may already have a parent
                reference.block.setParentId(setVariableTo.id);
            }
            if (!stack.subBlocks.includes(reference.block)) stack.subBlocks.push(reference.block); // TODO: remove, see comments above
        }
        stack.orderedStackBlocks.push(setVariableTo);
    }

    generateCopyStructValuesBlocks(
        uniqueIds: IdGenerator,
        from: ListDefinition|SubListDefinition|ParameterDefinition[]|StructFieldsExpression,
        to: ListDefinition|SubListDefinition,
        type: Type,
        parameterVariables: Map<ParameterSymbol, PossibleParameterRedefinition>,
        existingTypes: ExistingTypes,
        stack: Stack,
        errorCollector: ErrorCollector
    ) {
        if (!(type instanceof ClassInstanceType)) {
            if (from instanceof StructFieldsExpression) throw new Error("Unexpected struct fields for single value");
            this.generateReplaceSingleList(uniqueIds, from, to, stack);
            return;
        }

        if (to instanceof SubListDefinition) {
            for (let i = 0; i < to.sliceSize; i++) {
                stack.orderedStackBlocks.push(
                    new Block(
                        uniqueIds.nextId(),
                        "data_deleteoflist",
                        { INDEX: new Shadowed(undefined, new NumberValue(to.sliceStart + 1 /* scratch indexes start at 1 */)) },
                        { LIST: [ to.list.name, to.list.id ] }
                    )
                );
            }
        } else {
            stack.orderedStackBlocks.push(
                new Block(
                    uniqueIds.nextId(),
                    "data_deletealloflist",
                    {},
                    { LIST: [ to.name, to.id ] }
                )
            );
        }
        this.recursiveGenerateCopyStructValuesBlocksImpl(uniqueIds, 0, from, to, type, parameterVariables, existingTypes, stack, errorCollector);
    }

    generateAssignmentBlockForVariable(
        uniqueIds: IdGenerator,
        type: Type,
        assignmentValue: Expression,
        accessVariable: VariableDefinition|ListDefinition|SubListDefinition|undefined,
        parameterVariables: Map<ParameterSymbol, PossibleParameterRedefinition>,
        existingTypes: ExistingTypes,
        stack: Stack,
        errorCollector: ErrorCollector
    ) {
        if (accessVariable instanceof VariableDefinition) {
            if (type.size !== 1) throw new Error("Got variable definition for type not of size 1");

            const value = this.generateBlocksForCodeBlock(uniqueIds, assignmentValue, parameterVariables, existingTypes, stack, errorCollector);

            if (value instanceof Value) {
                const setVariableTo = new Block(
                    uniqueIds.nextId(),
                    "data_setvariableto",
                    { VALUE: new Shadowed(undefined, value) },
                    { VARIABLE: [ accessVariable.name, accessVariable.id ] }
                );

                stack.orderedStackBlocks.push(setVariableTo);
            } else if (value instanceof VariableDefinition) {
                const setVariableTo = new Block(
                    uniqueIds.nextId(),
                    "data_setvariableto",
                    { VALUE: new Shadowed(undefined, new VariableValue(value.name, value.id)) },
                    { VARIABLE: [ accessVariable.name, accessVariable.id ] }
                );

                stack.orderedStackBlocks.push(setVariableTo);
            } else if (value instanceof ParameterDefinition) {
                const paramRefBlock = this.createParameterReferenceBlock(uniqueIds, value.name);
                stack.subBlocks.push(paramRefBlock);
                const setVariableTo = new Block(
                    uniqueIds.nextId(),
                    "data_setvariableto",
                    { VALUE: new Shadowed(undefined, new BlockRef(paramRefBlock)) },
                    { VARIABLE: [ accessVariable.name, accessVariable.id ] }
                );

                stack.orderedStackBlocks.push(setVariableTo);
            } else if (value instanceof ListDefinition) {
                throw new Error("Got list definition to assign to variable");
            } else if (value instanceof SubListDefinition) {
                if (value.sliceSize !== 1) throw new Error("Got list definition to assign to variable");
                this.generateSetSingleVariable(uniqueIds, value, accessVariable, stack);
            } else if (Array.isArray(value)) {
                if (value.length !== 1) throw new Error("Got list definition to assign to variable");
                this.generateSetSingleVariable(uniqueIds, value, accessVariable, stack);
            } else if (value instanceof Stack) {
                throw new Error("Got blocks to assign to variable");
            }
        } else if (accessVariable instanceof ListDefinition || accessVariable instanceof SubListDefinition) {
            if (assignmentValue instanceof StructFieldsExpression) {
                this.generateCopyStructValuesBlocks(uniqueIds, assignmentValue, accessVariable, type, parameterVariables, existingTypes, stack, errorCollector);
                return;
            }

            const value = this.generateBlocksForCodeBlock(uniqueIds, assignmentValue, parameterVariables, existingTypes, stack, errorCollector);

            if (value instanceof Value) {
                if (type.size > 1) throw new Error("Cannot assign value to non-singular list definition");
                this.generateReplaceSingleList(uniqueIds, value, accessVariable, stack);
            } else if (value instanceof VariableDefinition) {
                if (type.size > 1) throw new Error("Cannot assign value to non-singular list definition");
                this.generateReplaceSingleList(uniqueIds, value, accessVariable, stack);
            } else if (value instanceof ListDefinition || value instanceof SubListDefinition || Array.isArray(value)) {
                this.generateCopyStructValuesBlocks(uniqueIds, value, accessVariable, type, parameterVariables, existingTypes, stack, errorCollector);
            } else if (Array.isArray(value)) {
                this.generateCopyStructValuesBlocks(uniqueIds, value, accessVariable, type, parameterVariables, existingTypes, stack, errorCollector);
            } else if (value instanceof Stack) {
                throw new Error("Got blocks to assign to variable");
            }
        }
    }

    generateAssignmentBlocks(
        uniqueIds: IdGenerator,
        expression: AssignmentExpression|VariableDeclarationExpression,
        parameterVariables: Map<ParameterSymbol, PossibleParameterRedefinition>,
        existingTypes: ExistingTypes,
        stack: Stack,
        errorCollector: ErrorCollector
    ) {
        if (expression instanceof AssignmentExpression && expression.reference instanceof AccessorExpression) {
            const baseType = inferExpressionType(expression.reference, this, existingTypes, errorCollector);
            const baseReference = this.generateBlocksForCodeBlock(uniqueIds, expression.reference, parameterVariables, existingTypes, stack, errorCollector);
            if (baseReference === undefined) throw new Error("Failed to get base to assign");
            if (baseReference instanceof Value || baseReference instanceof Stack) throw new Error("Cannot assign stack or value");
            
            const rightType = inferExpressionType(expression.value, this, existingTypes, errorCollector);
    
            if (!baseType.isEquivalentTo(rightType)) throw new Error("Bad assignment");
            if (baseReference instanceof ParameterDefinition || Array.isArray(baseReference))
                throw new Error("Unexpected parameter definition reference for re-assignment");

            this.generateAssignmentBlockForVariable(uniqueIds, baseType, expression.value, baseReference, parameterVariables, existingTypes, stack, errorCollector);
            return;
        }

        const leftSymbol = expression instanceof VariableDeclarationExpression
            ? this.getIdentifierReference(expression.identifier)
            : this.getIdentifierReference((expression.reference as KeywordExpression).keyword);

        const assignmentValue = expression instanceof VariableDeclarationExpression
            ? expression.initialValue
            : expression.value;

        if (leftSymbol instanceof VariableSymbol) {
            const varReference = leftSymbol.getVarDefinitionReference(uniqueIds, existingTypes, errorCollector, stack.sprite);
            const leftType = resolveSymbolType(leftSymbol, existingTypes, errorCollector);
            const rightType = inferExpressionType(assignmentValue, this, existingTypes, errorCollector);
    
            if (!leftType.isEquivalentTo(rightType)) throw new Error("Bad assignment");
    
            this.generateAssignmentBlockForVariable(uniqueIds, leftType, assignmentValue, varReference, parameterVariables, existingTypes, stack, errorCollector);
        } else if (leftSymbol instanceof ParameterSymbol) {
            const accessVariable = parameterVariables.get(leftSymbol);
            if (accessVariable instanceof ParameterDefinition || Array.isArray(accessVariable))
                throw new Error("Got assignment of parameter, but no intermediary variable or list is recognised.");

            const leftType = resolveSymbolType(leftSymbol, existingTypes, errorCollector);
            const rightType = inferExpressionType(assignmentValue, this, existingTypes, errorCollector);
    
            if (!leftType.isEquivalentTo(rightType)) throw new Error("Bad assignment");
        
            this.generateAssignmentBlockForVariable(uniqueIds, leftType, assignmentValue, accessVariable, parameterVariables, existingTypes, stack, errorCollector);
        } else {
            throw new Error("Invalid assignment");
        }
    }

    protected getProcType(reference: Expression, existingTypes: ExistingTypes, errorCollector: ErrorCollector) {
        if (reference instanceof KeywordExpression) {
            
        }
        return inferExpressionType(reference, this, existingTypes, errorCollector);
    }

    generateBlocksForCodeBlock(
        uniqueIds: IdGenerator,
        expression: Expression,
        parameterVariables: Map<ParameterSymbol, VariableDefinition|ListDefinition|ParameterDefinition|ParameterDefinition[]>,
        existingTypes: ExistingTypes,
        stack: Stack,
        errorCollector: ErrorCollector
    ): PossibleReference {
        if (expression instanceof ParenthesisExpression) {
            const subStack = stack.sprite.createStack();
            let result: PossibleReference = undefined;
            for (const subExpression of expression.expressions) {
                result = this.generateBlocksForCodeBlock(uniqueIds, subExpression, parameterVariables, existingTypes, subStack, errorCollector);
            }
            stack.applySubstack(subStack);
            return result;
        } else if (expression instanceof FunctionCallExpression) {
            if (expression.reference instanceof KeywordExpression && this.getIdentifierReference(expression.reference.keyword) instanceof ProcedureSymbol) { // handle procedure call directly
                const reference = this.getIdentifierReference(expression.reference.keyword);
                if (reference === undefined) throw new Error(`Identifier not found: ${expression.reference.keyword}`);
                const procType = resolveSymbolType(reference, existingTypes, errorCollector);
                if (!(procType instanceof ProcedureSignatureType)) throw new Error(`Cannot type of ${procType.getName()}`);
                if (procType.functionSymbol === undefined) throw new Error(`Cannot call procedure type declaration`);

                const argReferences = expression.args.map(arg => this.generateBlocksForCodeBlock(uniqueIds, arg, parameterVariables, existingTypes, stack, errorCollector));
                for (const argReference of argReferences) {
                    if (argReference instanceof Stack) {
                        throw new Error("Cannot pass stack as argument into parameter");
                    }
                }
                const paramReferenceBlocks: (Value|BlockRef)[] = [];
                this.recursiveArgumentsCreateReferenceBlocks(
                    uniqueIds,
                    procType.params.map(param => param.type),
                    argReferences as (ListDefinition|VariableDefinition|SubListDefinition|ParameterDefinition|ParameterDefinition[])[],
                    paramReferenceBlocks,
                    stack
                );
    
                const procedureCall = this.createProcedureCallBlock(
                    uniqueIds,
                    procType.functionSymbol.getProcCode(uniqueIds, existingTypes, errorCollector),
                    procType.functionSymbol.getParameterIds(uniqueIds, existingTypes, errorCollector),
                    paramReferenceBlocks
                );
                stack.orderedStackBlocks.push(procedureCall);
                return procType.functionSymbol.getReturnValueReference(uniqueIds, existingTypes, errorCollector, stack.sprite);
            }

            // handle procedure used as value, which is proxied through a broadcast using a list as arguments
            const procType = inferExpressionType(expression.reference, this, existingTypes, errorCollector);
            if (!(procType instanceof ProcedureSignatureType)) throw new Error(`Cannot type of ${procType.getName()}`);
            const procReference = this.generateBlocksForCodeBlock(uniqueIds, expression.reference, parameterVariables, existingTypes, stack, errorCollector);
            if (procReference === undefined || procReference instanceof Stack) throw new Error("Nothing to call");

            const argReferences = expression.args.map(arg => this.generateBlocksForCodeBlock(uniqueIds, arg, parameterVariables, existingTypes, stack, errorCollector));
            for (const argReference of argReferences) {
                if (argReference instanceof Stack) {
                    throw new Error("Cannot pass stack as argument into parameter");
                }
            }
            const paramReferenceBlocks: (Value|BlockRef)[] = [];
            this.recursiveArgumentsCreateReferenceBlocks(
                uniqueIds,
                procType.params.map(param => param.type),
                argReferences as (ListDefinition|VariableDefinition|SubListDefinition|ParameterDefinition|ParameterDefinition[])[],
                paramReferenceBlocks,
                stack
            );

            const broadcastProxyList = procType.functionSymbol!.getBroadcastProxyParamsReference(uniqueIds, existingTypes, stack.sprite, errorCollector);
            stack.orderedStackBlocks.push(
                new Block(
                    uniqueIds.nextId(),
                    "data_deletealloflist",
                    {},
                    {
                        LIST: [ broadcastProxyList.name, broadcastProxyList.id ]
                    }
                )
            );
            for (const param of paramReferenceBlocks) {
                const addFieldToList = new Block(
                    uniqueIds.nextId(),
                    "data_addtolist",
                    { ITEM: new Shadowed(undefined, param) },
                    { LIST: [ broadcastProxyList.name, broadcastProxyList.id ] }
                );
                stack.orderedStackBlocks.push(addFieldToList);
            }
            const broadcast = procType.functionSymbol!.getBroadcastProxyReference(uniqueIds, existingTypes, stack.sprite, errorCollector);
            const ref = this.createSingleStructValueReference(uniqueIds, procReference);
            const broadcastBlock = new Block(
                uniqueIds.nextId(),
                "event_broadcastandwait",
                { BROADCAST_INPUT: new Shadowed(new BroadcastValue(broadcast.name, broadcast.id), ref) },
                { }
            );
            if (ref instanceof BlockRef) {
                ref.block.setParentId(broadcastBlock.id);
                stack.subBlocks.push(ref.block);
            }
            stack.orderedStackBlocks.push(broadcastBlock);
            return procType.functionSymbol!.getReturnValueReference(uniqueIds, existingTypes, errorCollector, stack.sprite);
        } else if (expression instanceof AssignmentExpression || expression instanceof VariableDeclarationExpression) {
            this.generateAssignmentBlocks(uniqueIds, expression, parameterVariables, existingTypes, stack, errorCollector);
        } else if (expression instanceof ReturnStatementExpression) {
            const varReference = this.getReturnValueReference(uniqueIds, existingTypes, errorCollector, stack.sprite);
            const returnType = getProcedureSignature(this, existingTypes, errorCollector).returnType;
            const expressionType = expression.expression === undefined
                ? VoidType.DEFINITION
                : inferExpressionType(expression.expression, this, existingTypes, errorCollector);
    
            if (!returnType.isEquivalentTo(expressionType)) throw new Error("Bad assignment");

            if (expression.expression === undefined) return;
    
            this.generateAssignmentBlockForVariable(uniqueIds, returnType, expression.expression, varReference, parameterVariables, existingTypes, stack, errorCollector);
        } else if (expression instanceof KeywordExpression) {
            const refSymbol = this.getIdentifierReference(expression.keyword);
            if (refSymbol instanceof VariableSymbol) {
                return refSymbol.getVarDefinitionReference(uniqueIds, existingTypes, errorCollector, stack.sprite);
            } else if (refSymbol instanceof ParameterSymbol) {
                const accessVariable = parameterVariables.get(refSymbol);
                if (accessVariable === undefined)
                    throw new Error("Failed to get parameter variable access.");

                return accessVariable;
            } else if (refSymbol instanceof ProcedureSymbol) {
                if (!refSymbol.flags.has(SymbolFlag.ProcUsedAsValue)) throw new Error("Assertion failed: procedure should be marked as being used as a value, broadcast may not exist");

                const proxyBroadcast = refSymbol.getBroadcastProxyReference(uniqueIds, existingTypes, stack.sprite, errorCollector);
                return new StringValue(proxyBroadcast.name);
            } {
                throw new Error("Invalid assignment");
            }
        } else if (expression instanceof AccessorExpression) {
            const baseType = inferExpressionType(expression.base, this, existingTypes, errorCollector);
            const baseAccess = this.generateBlocksForCodeBlock(uniqueIds, expression.base, parameterVariables, existingTypes, stack, errorCollector);
            if (baseAccess instanceof Stack) throw new Error("Cannot access property on stack");
            if (!(baseType instanceof ClassInstanceType)) throw new Error("Cannot access property on non-class");

            const fieldType = baseType.fields.get(expression.property.keyword);
            if (fieldType === undefined) throw new Error(`No field on class '${baseType.classSymbol.name}' of property '${expression.property.keyword}'`);
            if (Array.isArray(baseAccess)) {
                return baseAccess.slice(fieldType.offset, fieldType.offset + fieldType.type.size);
            } else if (baseAccess instanceof VariableDefinition) {
                throw new Error("Cannot access property on variable definition");
            } else if (baseAccess instanceof ParameterDefinition) {
                throw new Error("Cannot access property on parameter definition");
            } else if (baseAccess instanceof Value) {
                throw new Error("Cannot access property on value");
            } else if (baseAccess instanceof ListDefinition) {
                return new SubListDefinition(baseAccess, fieldType.offset, fieldType.type.size);
            } else if (baseAccess instanceof SubListDefinition) {
                return new SubListDefinition(baseAccess.list, baseAccess.sliceStart + fieldType.offset, fieldType.type.size);
            }
        } else if (expression instanceof NumberExpression) {
            return new NumberValue(parseFloat(expression.unprocessedNumber));
        } else if (expression instanceof StringExpression) {
            return new StringValue(expression.text);
        }

        return undefined;
    } 

    generateBlocksForSprite(uniqueIds: IdGenerator, existingTypes: ExistingTypes, sprite: Sprite, errorCollector: ErrorCollector) {
        if (!(this.expression instanceof ProcDeclarationExpression) || !this.expression.isCodeDefinition())
            throw new Error("Cannot generate code for procedure signature declaration");

        const typeSignature = getProcedureSignature(this, existingTypes, errorCollector);
        const parameterDefinitions: ParameterDefinition[] = [];
        const parameterVariables: Map<ParameterSymbol, VariableDefinition|ListDefinition|ParameterDefinition|ParameterDefinition[]> = new Map;
        const procStack = sprite.createStack();
        for (const parameter of typeSignature.params) {
            if (parameter.parameterSymbol === undefined) continue;

            if (parameter.type instanceof ClassInstanceType) {
                const subParamDefinitions = this.expandProcedureParameters(uniqueIds, parameter.parameterSymbol.name, parameter.type, existingTypes, errorCollector);
                if (subParamDefinitions.length !== parameter.type.size) throw new Error(`Expected ${parameter.type.size} parameter(s)`);
                parameterDefinitions.push(...subParamDefinitions);
                if (parameter.parameterSymbol.flags.has(SymbolFlag.ParamReassigned)) {
                    if (parameter.type.size > 1) {
                        const list = this.createIntermediateParamList(uniqueIds, "mut:" + parameter.parameterSymbol.name, subParamDefinitions, procStack);
                        parameterVariables.set(parameter.parameterSymbol, list);
                    } else {
                        const variable = this.createIntermediateParamVariable(uniqueIds, "mut:" + subParamDefinitions[0].name, subParamDefinitions[0], procStack);
                        parameterVariables.set(parameter.parameterSymbol, variable);
                    }
                } else {
                    parameterVariables.set(parameter.parameterSymbol, subParamDefinitions);
                }
            } else {
                const parameterDefinition = this.createParameterDefinition(uniqueIds, parameter.parameterSymbol.name);
                parameterDefinitions.push(parameterDefinition);
                if (parameter.parameterSymbol.flags.has(SymbolFlag.ParamReassigned)) {
                    const variable = this.createIntermediateParamVariable(uniqueIds, "mut:" + parameter.parameterSymbol.name, parameterDefinition, procStack);
                    parameterVariables.set(parameter.parameterSymbol, variable);
                } else {
                    parameterVariables.set(parameter.parameterSymbol, parameterDefinition);
                }
            }
        }

        const parameterIds = this.getParameterIds(uniqueIds, existingTypes, errorCollector);
        const procedurePrototype = this.createProcedurePrototypeBlock(uniqueIds, parameterIds, parameterDefinitions, existingTypes, errorCollector);
        for (const parameterDefinition of parameterDefinitions) {
            procStack.subBlocks.push(parameterDefinition.block);
            parameterDefinition.block.setParentId(procedurePrototype.id);
        }
        const procedureDefinition = this.createProcedureDefinitionBlock(uniqueIds, procedurePrototype);
        procedurePrototype.setParentId(procedureDefinition.id);

        procStack.subBlocks.push(procedurePrototype);

        if (this.flags.has(SymbolFlag.ProcUsedAsValue)) {
            const broadcastStack = sprite.createStack();
            this.generateProcedureBroadcastProxyBlocksForSprite(uniqueIds, parameterIds, existingTypes, broadcastStack, errorCollector);
        }

        this.generateBlocksForCodeBlock(uniqueIds, this.expression.block, parameterVariables, existingTypes, procStack, errorCollector);
        sprite.applyStack(procStack, procedureDefinition);
    }
}