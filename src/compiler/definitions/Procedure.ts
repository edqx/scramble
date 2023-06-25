import { ErrorCollector } from "../../errorCollector";
import { AccessorExpression, AssignmentExpression, Expression, FunctionCallExpression, KeywordExpression, NumberExpression, ParenthesisExpression, ProcDeclarationExpression, ReturnStatementExpression, ScriptExpression, StringExpression } from "../../expression";
import { Block, BlockRef, ListDefinition, NumberValue, Shadowed, StringValue, Value, VariableDefinition, VariableValue } from "../../scratch";
import { ExistingTypes } from "../ExistingTypes";
import { IdGenerator } from "../IdGenerator";
import { Sprite, Stack } from "../Sprite";
import { staticallyAnalyseExpressionDeclaration } from "../analysis";
import { inferExpressionType } from "../inferExpressionType";
import { getProcedureSignature, resolveSymbolType } from "../resolveSymbolType";
import { SymbolDeclarationStore } from "../symbolDeclarationStore";
import { ClassInstanceType } from "../types";
import { ClassSymbol } from "./Class";
import { MacroSymbol } from "./Macro";
import { ParameterSymbol } from "./Parameter";
import { ScopedSymbol, SymbolFlag, SymbolType } from "./Symbol";
import { VariableSymbol } from "./Variable";

export class ParameterDefinition {
    constructor(public readonly name: string, public readonly block: Block) {}
}

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
                { ITEM: new Shadowed(undefined, new BlockRef(argReference.id)) },
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
            { VALUE: new Shadowed(undefined, new BlockRef(argReference.id)) },
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
                    return [ id, new Shadowed(undefined, new BlockRef(parameterDefinitions[i].block.id)) ];
                })
            ),
            { },
            true, false,
            {
                tagName: "mutation",
                children: [],
                proccode: this.name + (parameterIds.length > 0 ? " " + parameterIds.map(() => "%s") : ""),
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
            { custom_block: new Shadowed(undefined, new BlockRef(procedurePrototype.id)) },
            { },
            false, true
        );
    }

    generateBlocksForCodeBlock(
        uniqueIds: IdGenerator,
        expression: Expression,
        parameterVariables: Map<ParameterSymbol, VariableDefinition|ListDefinition|ParameterDefinition|ParameterDefinition[]>,
        existingTypes: ExistingTypes,
        stack: Stack,
        errorCollector: ErrorCollector
    ): (Block|Value|VariableDefinition|ListDefinition|ParameterDefinition|ParameterDefinition[])[] {
        if (expression instanceof ParenthesisExpression) {

        } else if (expression instanceof FunctionCallExpression) {

        } else if (expression instanceof AssignmentExpression) {
            if (expression.reference instanceof AccessorExpression) {
                throw new Error("Assigning accessor expression not implemented yet.");
            }

            const leftSymbol = this.getIdentifierReference(expression.reference.keyword);

            if (leftSymbol instanceof VariableSymbol) {
                
            } else if (leftSymbol instanceof ParameterSymbol) {
                const accessVariable = parameterVariables.get(leftSymbol);
                if (accessVariable instanceof ParameterDefinition || Array.isArray(accessVariable))
                    throw new Error("Got assignment of parameter, but no intermediary variable or list is recognised.");

                const leftType = resolveSymbolType(leftSymbol, existingTypes, errorCollector);
                const rightType = inferExpressionType(expression.value, this, existingTypes, errorCollector);

                if (!leftType.isEquivalentTo(rightType)) throw new Error("Bad assignment");

                if (accessVariable instanceof VariableDefinition) {
                    if (leftType.size !== 1) throw new Error("Got variable definition for type not of size 1");

                    const value = this.generateBlocksForCodeBlock(uniqueIds, expression.value, parameterVariables, existingTypes, stack, errorCollector);
                    const setVariableTo = new Block(
                        uniqueIds.nextId(),
                        "data_setvariableto",
                        { VALUE: new Shadowed() }
                    );
                    stack.orderedStackBlocks.push(setVariableTo);
                    stack.subBlocks.push(value);
                } else if (accessVariable instanceof ListDefinition) {

                }
            } else {
                throw new Error("Invalid assignment");
            }
        } else if (expression instanceof ReturnStatementExpression) {

        } else if (expression instanceof KeywordExpression) {
            const refSymbol = this.getIdentifierReference(expression.keyword);
            if (refSymbol instanceof VariableSymbol) {
                return [ refSymbol.getVarDefinitionReference(uniqueIds, existingTypes, errorCollector, stack.sprite) ];
            } else if (refSymbol instanceof ParameterSymbol) {
                const accessVariable = parameterVariables.get(refSymbol);
                if (accessVariable === undefined)
                    throw new Error("Failed to get parameter variable access.");

                return [ accessVariable ];
            } else {
                throw new Error("Invalid assignment");
            }
        } else if (expression instanceof NumberExpression) {
            return [ new NumberValue(parseFloat(expression.unprocessedNumber)) ];
        } else if (expression instanceof StringExpression) {
            return [ new StringValue(expression.text) ];
        }

        return [];
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
        sprite.applyStack(stack, procedureDefinition);

        this.generateBlocksForCodeBlock(uniqueIds, this.expression.block, parameterVariables, existingTypes, stack, errorCollector);
    }
}