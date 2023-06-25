import { ErrorCollector } from "../../errorCollector";
import { AccessorExpression, AssignmentExpression, Expression, FunctionCallExpression, KeywordExpression, NumberExpression, ParenthesisExpression, ProcDeclarationExpression, ReturnStatementExpression, ScriptExpression, StringExpression, StructFieldsExpression, VariableDeclarationExpression } from "../../expression";
import { Block, BlockRef, ListDefinition, ListValue, NumberValue, Shadowed, StringValue, Value, VariableDefinition, VariableValue } from "../../scratch";
import { ExistingTypes } from "../ExistingTypes";
import { IdGenerator } from "../IdGenerator";
import { Sprite, Stack } from "../../scratch/Sprite";
import { staticallyAnalyseExpressionDeclaration } from "../analysis";
import { inferExpressionType } from "../inferExpressionType";
import { getProcedureSignature, resolveSymbolType } from "../resolveSymbolType";
import { SymbolDeclarationStore } from "../symbolDeclarationStore";
import { ClassInstanceType } from "../types";
import { ClassSymbol } from "./Class";
import { MacroSymbol } from "./Macro";
import { ParameterSymbol } from "./Parameter";
import { CodeSymbol, ScopedSymbol, SymbolFlag, SymbolType } from "./Symbol";
import { VariableSymbol } from "./Variable";

export class ParameterDefinition {
    constructor(public readonly name: string, public readonly block: Block) {}
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
            }
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
            const argReference = this.createParameterReferenceBlock(uniqueIds, param.name);
            const addFieldToList = new Block(
                uniqueIds.nextId(),
                "data_addtolist",
                { ITEM: new Shadowed(undefined, new BlockRef(argReference)) },
                { LIST: [ list.name, list.id ] }
            );
            argReference.setParentId(addFieldToList.id);
            stack.orderedStackBlocks.push(addFieldToList);
            stack.subBlocks.push(argReference);
        }
        return list;
    }

    createIntermediateParamVariable(uniqueIds: IdGenerator, varName: string, param: ParameterDefinition, stack: Stack) {
        const variable = stack.sprite.createVariable(uniqueIds.nextId(), varName);
        const argReference = this.createParameterReferenceBlock(uniqueIds, param.name);
        const setVarTo = new Block(
            uniqueIds.nextId(),
            "data_setvariableto",
            { VALUE: new Shadowed(undefined, new BlockRef(argReference)) },
            { VARIABLE: [ variable.name, variable.id ] }
        );
        argReference.setParentId(setVarTo.id);
        stack.orderedStackBlocks.push(setVarTo);
        stack.subBlocks.push(argReference);
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
        from: ListDefinition|ParameterDefinition[]|StructFieldsExpression,
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
        } else {
            const listItemReference = new Block(
                uniqueIds.nextId(),
                "data_itemoflist",
                { INDEX: new Shadowed(undefined, new NumberValue(index)) },
                { LIST: [ from.name, from.id ] }
            );
            return new BlockRef(listItemReference);
        }
    }

    protected recursiveGenerateCopyStructValuesBlocksImpl(
        uniqueIds: IdGenerator,
        index: number,
        from: ListDefinition|ParameterDefinition[]|StructFieldsExpression,
        to: ListDefinition,
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
                    console.log(field.fieldSymbol.name, field, from, initializationFieldValue);
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
            index++;
        }
    }

    generateCopyStructValuesBlocks(
        uniqueIds: IdGenerator,
        from: ListDefinition|ParameterDefinition[]|StructFieldsExpression,
        to: ListDefinition,
        type: ClassInstanceType,
        parameterVariables: Map<ParameterSymbol, PossibleParameterRedefinition>,
        existingTypes: ExistingTypes,
        stack: Stack,
        errorCollector: ErrorCollector
    ) {
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
        this.recursiveGenerateCopyStructValuesBlocksImpl(uniqueIds, 0, from, to, type, parameterVariables, existingTypes, stack, errorCollector);
    }

    generateAssignmentBlockForVariable(
        uniqueIds: IdGenerator,
        leftSymbol: CodeSymbol,
        assignmentValue: Expression,
        accessVariable: VariableDefinition|ListDefinition|undefined,
        parameterVariables: Map<ParameterSymbol, PossibleParameterRedefinition>,
        existingTypes: ExistingTypes,
        stack: Stack,
        errorCollector: ErrorCollector
    ) {
        const leftType = resolveSymbolType(leftSymbol, existingTypes, errorCollector);
        const rightType = inferExpressionType(assignmentValue, this, existingTypes, errorCollector);

        if (!leftType.isEquivalentTo(rightType)) throw new Error("Bad assignment");

        if (accessVariable instanceof VariableDefinition) {
            if (leftType.size !== 1) throw new Error("Got variable definition for type not of size 1");

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
            } else if (value instanceof ListDefinition || Array.isArray(value)) {
                throw new Error("Got list definition to assign to variable");
            } else if (value instanceof Stack) {
                throw new Error("Got blocks to assign to variable");
            }
        } else if (accessVariable instanceof ListDefinition) {
            if (leftType.size === 1) throw new Error("Got list definition for type of size 1");
            if (!(leftType instanceof ClassInstanceType) || !(rightType instanceof ClassInstanceType)) throw new Error("Got list definition for non-class");

            if (assignmentValue instanceof StructFieldsExpression) {
                this.generateCopyStructValuesBlocks(uniqueIds, assignmentValue, accessVariable, leftType, parameterVariables, existingTypes, stack, errorCollector);
                return;
            }

            const value = this.generateBlocksForCodeBlock(uniqueIds, assignmentValue, parameterVariables, existingTypes, stack, errorCollector);

            if (value instanceof Value) {
                throw new Error("Got value definition to assign to list");
            } else if (value instanceof VariableDefinition) {
                throw new Error("Got variable definition to assign to list");
            } else if (value instanceof ListDefinition) {
                this.generateCopyStructValuesBlocks(uniqueIds, value, accessVariable, leftType, parameterVariables, existingTypes, stack, errorCollector);
            } else if (Array.isArray(value)) {
                this.generateCopyStructValuesBlocks(uniqueIds, value, accessVariable, leftType, parameterVariables, existingTypes, stack, errorCollector);
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
        if (expression instanceof AssignmentExpression && expression.reference instanceof AccessorExpression)
            throw new Error("Assigning accessor expression not implemented yet.");
        
        const leftSymbol = expression instanceof VariableDeclarationExpression
            ? this.getIdentifierReference(expression.identifier)
            : this.getIdentifierReference((expression.reference as KeywordExpression).keyword);

        const assignmentValue = expression instanceof VariableDeclarationExpression
            ? expression.initialValue
            : expression.value;

        if (leftSymbol instanceof VariableSymbol) {
            const varReference = leftSymbol.getVarDefinitionReference(uniqueIds, existingTypes, errorCollector, stack.sprite);
            this.generateAssignmentBlockForVariable(uniqueIds, leftSymbol, assignmentValue, varReference, parameterVariables, existingTypes, stack, errorCollector);
        } else if (leftSymbol instanceof ParameterSymbol) {
            const accessVariable = parameterVariables.get(leftSymbol);
            if (accessVariable instanceof ParameterDefinition || Array.isArray(accessVariable))
                throw new Error("Got assignment of parameter, but no intermediary variable or list is recognised.");

            this.generateAssignmentBlockForVariable(uniqueIds, leftSymbol, assignmentValue, accessVariable, parameterVariables, existingTypes, stack, errorCollector);
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
    ): Stack|Value|VariableDefinition|ListDefinition|ParameterDefinition|ParameterDefinition[]|undefined {
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
                const paramDefinition = this.createParameterDefinition(uniqueIds, parameter.parameterSymbol.name);
                this.createIntermediateParamVariable(uniqueIds, "mut:" + parameter.parameterSymbol.name, paramDefinition, stack);
                parameterVariables.set(parameter.parameterSymbol, paramDefinition);
            }
        }

        const procedurePrototype = this.createProcedurePrototypeBlock(uniqueIds, parameterDefinitions);
        const procedureDefinition = this.createProcedureDefinitionBlock(uniqueIds, procedurePrototype);

        stack.subBlocks.push(procedurePrototype);
        stack.orderedStackBlocks.unshift(procedureDefinition); // proc definition always at top

        this.generateBlocksForCodeBlock(uniqueIds, this.expression.block, parameterVariables, existingTypes, stack, errorCollector);
        sprite.applyStack(stack, procedureDefinition);
    }
}