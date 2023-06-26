import { ErrorCollector } from "../../errorCollector";
import { AccessorExpression, AssignmentExpression, Expression, FunctionCallExpression, KeywordExpression, NumberExpression, ParenthesisExpression, ProcDeclarationExpression, ReturnStatementExpression, ScriptExpression, StringExpression, StructFieldsExpression, VariableDeclarationExpression } from "../../expression";
import { Block, BlockRef, ListDefinition, NumberValue, Shadowed, StringValue, Value, VariableDefinition, VariableValue } from "../../scratch";
import { ExistingTypes } from "../ExistingTypes";
import { IdGenerator } from "../IdGenerator";
import { Sprite, Stack } from "../../scratch/Sprite";
import { staticallyAnalyseExpressionDeclaration } from "../analysis";
import { inferExpressionType } from "../inferExpressionType";
import { getProcedureSignature, resolveSymbolType } from "../resolveSymbolType";
import { SymbolDeclarationStore } from "../symbolDeclarationStore";
import { ClassInstanceType, Type } from "../types";
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

    constructor(id: string, parent: ProcedureSymbol|ClassSymbol|undefined, name: string, expression: ProcDeclarationExpression|ScriptExpression) {
        super(id, parent, SymbolType.Procedure, name, expression);

        this.flags.add(SymbolFlag.Hoisted);
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
            const addFieldToList = new Block(
                uniqueIds.nextId(),
                "data_addtolist",
                { ITEM: new Shadowed(undefined, new BlockRef(param.block)) },
                { LIST: [ list.name, list.id ] }
            );
            stack.orderedStackBlocks.push(addFieldToList);
        }
        return list;
    }

    createIntermediateParamVariable(uniqueIds: IdGenerator, varName: string, param: ParameterDefinition, stack: Stack) {
        const variable = stack.sprite.createVariable(uniqueIds.nextId(), varName);
        const setVarTo = new Block(
            uniqueIds.nextId(),
            "data_setvariableto",
            { VALUE: new Shadowed(undefined, new BlockRef(param.block)) },
            { VARIABLE: [ variable.name, variable.id ] }
        );
        stack.orderedStackBlocks.push(setVarTo);
        return variable;
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

    createProcedurePrototypeBlock(uniqueIds: IdGenerator, parameterDefinitions: ParameterDefinition[]) {
        // the argument IDs are NOT equal to the definition block IDs calculated above
        const parameterIds = parameterDefinitions.map(() => uniqueIds.nextId());
        
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
                proccode: this.name + (parameterIds.length > 0 ? " " + parameterIds.map(() => "%s").join(" ") : ""),
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
            return new BlockRef(from[index].block);
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
                { INDEX: new Shadowed(undefined, new NumberValue(index)) },
                { LIST: [ from.name, from.id ] }
            );
            return new BlockRef(listItemReference);
        } else if (from instanceof SubListDefinition) {
            const listItemReference = new Block(
                uniqueIds.nextId(),
                "data_itemoflist",
                { INDEX: new Shadowed(undefined, new NumberValue(from.sliceSize + index)) },
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
                    if (fieldReference.block.parentId === undefined) { // we re-use the parameter definition reporter block, so it may already have a parent
                        fieldReference.block.setParentId(insertFieldToList.id);
                        stack.subBlocks.push(fieldReference.block); // if it has a parent, it's probably already a sub block
                    }
                    if (!stack.subBlocks.includes(fieldReference.block)) throw new Error("Bad assertion"); // TODO: remove, see comments above
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
                    if (fieldReference.block.parentId === undefined) { // we re-use the parameter definition reporter block, so it may already have a parent
                        fieldReference.block.setParentId(addFieldToList.id);
                        stack.subBlocks.push(fieldReference.block); // if it has a parent, it's probably already a sub block
                    }
                    if (!stack.subBlocks.includes(fieldReference.block)) throw new Error("Bad assertion"); // TODO: remove, see comments above
                }
                stack.orderedStackBlocks.push(addFieldToList);
            }
            index++;
        }
    }

    createSingleStructValueReference(
        uniqueIds: IdGenerator,
        from: Value|VariableDefinition|ListDefinition|SubListDefinition|ParameterDefinition|ParameterDefinition[],
        parameterVariables:Map<ParameterSymbol, PossibleParameterRedefinition>
    ) {
        if (from instanceof Value) return from;
        if (from instanceof ParameterDefinition) return new BlockRef(from.block);
        if (Array.isArray(from)) return new BlockRef(from[0].block);
        if (from instanceof VariableDefinition) return new VariableValue(from.name, from.id);
        if (from instanceof ListDefinition) {
            const listItemReference = new Block(
                uniqueIds.nextId(),
                "data_itemoflist",
                { INDEX: new Shadowed(undefined, new NumberValue(0)) },
                { LIST: [ from.name, from.id ] }
            );
            return new BlockRef(listItemReference);
        }
        if (from instanceof SubListDefinition) {
            const listItemReference = new Block(
                uniqueIds.nextId(),
                "data_itemoflist",
                { INDEX: new Shadowed(undefined, new NumberValue(from.sliceStart)) },
                { LIST: [ from.list.name, from.list.id ] }
            );
            return new BlockRef(listItemReference);
        }
    }

    generateReplaceSingleList(
        uniqueIds: IdGenerator,
        from: Value|VariableDefinition|ListDefinition|SubListDefinition|ParameterDefinition|ParameterDefinition[],
        to: ListDefinition|SubListDefinition,
        type: Type,
        parameterVariables: Map<ParameterSymbol, PossibleParameterRedefinition>,
        existingTypes: ExistingTypes,
        stack: Stack,
        errorCollector: ErrorCollector
    ) {
        const reference = this.createSingleStructValueReference(uniqueIds, from, parameterVariables);
        const replaceFieldInList = new Block(
            uniqueIds.nextId(),
            "data_replaceitemoflist",
            {
                INDEX: new Shadowed(undefined, to instanceof ListDefinition ? new NumberValue(1) : new NumberValue(to.sliceStart + 1 /* scratch lists start at 1 */)),
                ITEM: new Shadowed(undefined, reference)
            },
            {
                LIST: to instanceof ListDefinition ? [ to.name, to.id ] : [ to.list.name, to.list.id ]
            }
        );

        if (reference instanceof BlockRef) {
            if (reference.block.parentId === undefined) { // we re-use the parameter definition reporter block, so it may already have a parent
                reference.block.setParentId(replaceFieldInList.id);
            }
            if (!stack.subBlocks.includes(reference.block)) stack.subBlocks.push(reference.block); // TODO: remove, see comments above
        }
        stack.orderedStackBlocks.push(replaceFieldInList);
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
            this.generateReplaceSingleList(uniqueIds, from, to, type, parameterVariables, existingTypes, stack, errorCollector);
            return;
        }

        if (to instanceof SubListDefinition) {
            for (let i = 0; i < to.sliceSize; i++) {
                stack.orderedStackBlocks.push(
                    new Block(
                        uniqueIds.nextId(),
                        "data_deleteoflist",
                        {
                            INDEX: new Shadowed(undefined, new NumberValue(to.sliceStart + 1 /* scratch indexes start at 1 */))
                        },
                        {
                            LIST: [ to.list.name, to.list.id ]
                        }
                    )
                );
            }
        } else {
            stack.orderedStackBlocks.push(
                new Block(
                    uniqueIds.nextId(),
                    "data_deletealloflist",
                    {},
                    {
                        LIST: [ to.name, to.id ]
                    }
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
                const setVariableTo = new Block(
                    uniqueIds.nextId(),
                    "data_setvariableto",
                    { VALUE: new Shadowed(undefined, new BlockRef(value.block)) },
                    { VARIABLE: [ accessVariable.name, accessVariable.id ] }
                );

                stack.orderedStackBlocks.push(setVariableTo);
            } else if (value instanceof ListDefinition || Array.isArray(value) || value instanceof SubListDefinition) {
                throw new Error("Got list definition to assign to variable");
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
                this.generateReplaceSingleList(uniqueIds, value, accessVariable, type, parameterVariables, existingTypes, stack, errorCollector);
            } else if (value instanceof VariableDefinition) {
                if (type.size > 1) throw new Error("Cannot assign value to non-singular list definition");
                this.generateReplaceSingleList(uniqueIds, value, accessVariable, type, parameterVariables, existingTypes, stack, errorCollector);
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

    generateBlocksForCodeBlock(
        uniqueIds: IdGenerator,
        expression: Expression,
        parameterVariables: Map<ParameterSymbol, VariableDefinition|ListDefinition|ParameterDefinition|ParameterDefinition[]>,
        existingTypes: ExistingTypes,
        stack: Stack,
        errorCollector: ErrorCollector
    ): Stack|Value|VariableDefinition|ListDefinition|SubListDefinition|ParameterDefinition|ParameterDefinition[]|undefined {
        if (expression instanceof ParenthesisExpression) {
            const subStack = stack.sprite.createStack();
            for (const subExpression of expression.expressions) {
                this.generateBlocksForCodeBlock(uniqueIds, subExpression, parameterVariables, existingTypes, subStack, errorCollector);
            }
            stack.applySubstack(subStack);
        } else if (expression instanceof FunctionCallExpression) {

        } else if (expression instanceof AssignmentExpression || expression instanceof VariableDeclarationExpression) {
            this.generateAssignmentBlocks(uniqueIds, expression, parameterVariables, existingTypes, stack, errorCollector);
        } else if (expression instanceof ReturnStatementExpression) {

        } else if (expression instanceof KeywordExpression) {
            const refSymbol = this.getIdentifierReference(expression.keyword);
            if (refSymbol instanceof VariableSymbol) {
                return refSymbol.getVarDefinitionReference(uniqueIds, existingTypes, errorCollector, stack.sprite);
            } else if (refSymbol instanceof ParameterSymbol) {
                const accessVariable = parameterVariables.get(refSymbol);
                if (accessVariable === undefined)
                    throw new Error("Failed to get parameter variable access.");

                return accessVariable;
            } else {
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
                return new SubListDefinition(baseAccess.list, fieldType.offset, fieldType.type.size);
            }
        } else if (expression instanceof NumberExpression) {
            return new NumberValue(parseFloat(expression.unprocessedNumber));
        } else if (expression instanceof StringExpression) {
            return new StringValue(expression.text);
        }

        return undefined;
    } 

    generateBlocks(uniqueIds: IdGenerator, existingTypes: ExistingTypes, sprite: Sprite, errorCollector: ErrorCollector) {
        if (!(this.expression instanceof ProcDeclarationExpression) || !this.expression.isCodeDefinition())
            throw new Error("Cannot generate code for procedure signature declaration");

        const typeSignature = getProcedureSignature(this, existingTypes, errorCollector);
        const parameterDefinitions: ParameterDefinition[] = [];
        const parameterVariables: Map<ParameterSymbol, VariableDefinition|ListDefinition|ParameterDefinition|ParameterDefinition[]> = new Map;
        const stack = sprite.createStack();
        for (const parameter of typeSignature.params) {
            if (parameter.parameterSymbol === undefined) continue;

            if (parameter.type instanceof ClassInstanceType) {
                const subParamDefinitions = this.expandProcedureParameters(uniqueIds, parameter.parameterSymbol.name, parameter.type, existingTypes, errorCollector);
                if (subParamDefinitions.length !== parameter.type.size) throw new Error(`Expected ${parameter.type.size} parameter(s)`);
                parameterDefinitions.push(...subParamDefinitions);
                if (parameter.parameterSymbol.flags.has(SymbolFlag.ParamReassigned)) {
                    if (parameter.type.size > 1) {
                        const list = this.createIntermediateParamList(uniqueIds, "mut:" + parameter.parameterSymbol.name, subParamDefinitions, stack);
                        parameterVariables.set(parameter.parameterSymbol, list);
                    } else {
                        const variable = this.createIntermediateParamVariable(uniqueIds, "mut:" + subParamDefinitions[0].name, subParamDefinitions[0], stack);
                        parameterVariables.set(parameter.parameterSymbol, variable);
                    }
                } else {
                    parameterVariables.set(parameter.parameterSymbol, subParamDefinitions);
                }
            } else {
                const parameterDefinition = this.createParameterDefinition(uniqueIds, parameter.parameterSymbol.name);
                parameterDefinitions.push(parameterDefinition);
                if (parameter.parameterSymbol.flags.has(SymbolFlag.ParamReassigned)) {
                    const variable = this.createIntermediateParamVariable(uniqueIds, "mut:" + parameter.parameterSymbol.name, parameterDefinition, stack);
                    parameterVariables.set(parameter.parameterSymbol, variable);
                } else {
                    parameterVariables.set(parameter.parameterSymbol, parameterDefinition);
                }
            }
        }

        const procedurePrototype = this.createProcedurePrototypeBlock(uniqueIds, parameterDefinitions);
        for (const parameterDefinition of parameterDefinitions) {
            console.log(parameterDefinition);
            stack.subBlocks.push(parameterDefinition.block);
            parameterDefinition.block.setParentId(procedurePrototype.id);
        }
        const procedureDefinition = this.createProcedureDefinitionBlock(uniqueIds, procedurePrototype);
        procedurePrototype.setParentId(procedureDefinition.id);

        stack.subBlocks.push(procedurePrototype);

        this.generateBlocksForCodeBlock(uniqueIds, this.expression.block, parameterVariables, existingTypes, stack, errorCollector);
        sprite.applyStack(stack, procedureDefinition);
    }
}