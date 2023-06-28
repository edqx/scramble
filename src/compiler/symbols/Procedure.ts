import * as util from "util";
import { ErrorCollector } from "../../errorCollector";
import { AccessorExpression, AssignmentExpression, Expression, ExpressionKind, KeywordExpression, NumberExpression, ParenthesisExpression, ProcDeclarationExpression, ScriptExpression, StringExpression, StructFieldsExpression, VariableDeclarationExpression } from "../../expression";
import { ExistingTypes } from "../ExistingTypes";
import { IdGenerator } from "../IdGenerator";
import { staticallyAnalyseExpressionDeclaration } from "../analysis";
import { CompositeDefinition, ListDefinition, ParameterDefinition, PresetDefinition, Sprite, Stack, VariableDefinition } from "../definitions";
import { getProcedureSignature, resolveSymbolType } from "../resolveSymbolType";
import { SymbolDeclarationStore } from "../symbolDeclarationStore";
import { ClassSymbol } from "./Class";
import { MacroSymbol } from "./Macro";
import { ParameterSymbol } from "./Parameter";
import { ScopedSymbol, SymbolFlag, SymbolType } from "./Symbol";
import { Block, BlockInput, BlockRef, NumberValue, Shadowed, StringValue, Value } from "../../scratch";
import { Definition } from "../definitions/Definition";
import { VariableSymbol } from "./Variable";
import { inferExpressionType } from "../inferExpressionType";
import { ClassInstanceType } from "../types";

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

    constructor(id: string, parent: ProcedureSymbol|ClassSymbol|undefined, name: string, expression: ProcDeclarationExpression|ScriptExpression) {
        super(id, parent, SymbolType.Procedure, name, expression);

        this.flags.add(SymbolFlag.Hoisted);
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
    
    protected definePresetForTypeStructInstantiationImpl(
        type: ClassInstanceType,
        structFields: StructFieldsExpression,
        stack: Stack,
        paramRedefinitions: Map<ParameterSymbol, CompositeDefinition>,
        uniqueIds: IdGenerator,
        existingTypes: ExistingTypes,
        errorCollector: ErrorCollector
    ) {
        const composite: Definition[] = [];
        for (const [ , field ] of type.fields) {
            const structField = structFields.assignments.find(assignment =>
                assignment.reference instanceof KeywordExpression && assignment.reference.keyword === field.fieldSymbol.name);

            if (structField === undefined) throw new Error(`Assertion failed; field '${field.fieldSymbol.name} not found in type instantiation`);

            const valueType = inferExpressionType(structField.value, this, existingTypes, errorCollector);
            if (!valueType.isEquivalentTo(field.type)) throw new Error(`Assertion failed; invalid field type '${field.fieldSymbol.name}`);
            
            const value = this.traverseAndGenerateBlocksForCodeBlock(structField.value, stack, paramRedefinitions, uniqueIds, existingTypes, errorCollector);
            if (value === undefined) throw new Error(`Assertion failed; invalid field type '${field.fieldSymbol.name}`);

            if (value instanceof BlockRef || value instanceof Value) {
                composite.push(new PresetDefinition(value));
            } else {
                composite.push(value);
            }
        }
        return new CompositeDefinition(type, composite);
    }

    definePresetForTypeStructInstantiation(type: ClassInstanceType, structFields: StructFieldsExpression, uniqueIds: IdGenerator) {
        
    }

    traverseAndGenerateBlocksForCodeBlock(
        block: Expression,
        stack: Stack,
        paramRedefinitions: Map<ParameterSymbol, CompositeDefinition>,
        uniqueIds: IdGenerator,
        existingTypes: ExistingTypes,
        errorCollector: ErrorCollector
    ): BlockInput|Definition|undefined {
        if (block instanceof ParenthesisExpression) {
            const substack = stack.sprite.createStack();
            let lastValue: BlockInput|Definition|undefined = undefined;
            for (const expression of block.expressions) {
                lastValue = this.traverseAndGenerateBlocksForCodeBlock(expression, substack, paramRedefinitions, uniqueIds, existingTypes, errorCollector);
            }
            stack.applySubstack(substack);
            return lastValue;
        } else if (block instanceof AssignmentExpression) {
            const assignmentType = inferExpressionType(block.reference, this, existingTypes, errorCollector);
            const valueType = inferExpressionType(block.value, this, existingTypes, errorCollector);

            if (!assignmentType.isEquivalentTo(valueType)) throw new Error("Assertion failed; invalid type of expression");

            const assignmentBlock = this.traverseAndGenerateBlocksForCodeBlock(block.reference, stack, paramRedefinitions, uniqueIds, existingTypes, errorCollector);
            if (!(assignmentBlock instanceof Definition)) throw new Error("Assertion failed; invalid assignment reference");

            const valueBlock = this.traverseAndGenerateBlocksForCodeBlock(block.value, stack, paramRedefinitions, uniqueIds, existingTypes, errorCollector);

            if (valueBlock instanceof Definition) {
                const copyInputs = valueBlock.generateInputs(uniqueIds);
                if (assignmentType.size !== copyInputs.length) throw new Error("Assertion failed; invalid inputs generated");
                for (let i = 0; i < assignmentType.size; i++) {
                    stack.orderedStackBlocks.push(...assignmentBlock.generateSetValueAtOffset(uniqueIds, copyInputs[i], i));
                }
            } else if (valueBlock instanceof Value) {
                stack.orderedStackBlocks.push(...assignmentBlock.generateSetValueAtOffset(uniqueIds, valueBlock, 0));
            } else {
                throw new Error("Assertion failed; invalid value");
            }
            return assignmentBlock;
        } else if (block instanceof VariableDeclarationExpression) {
            const assignmentSymbol = this.getIdentifierReference(block.identifier);
            if (!(assignmentSymbol instanceof VariableSymbol)) throw new Error("Assertion failed; identifier not a variable");

            const type = resolveSymbolType(assignmentSymbol, existingTypes, errorCollector);
            const initialValueType = inferExpressionType(block.initialValue, this, existingTypes, errorCollector);
            if (!initialValueType.isEquivalentTo(type)) throw new Error("Assertion failed; invalid type of expression");

            const valueBlock = this.traverseAndGenerateBlocksForCodeBlock(block.initialValue, stack, paramRedefinitions, uniqueIds, existingTypes, errorCollector);
            if (valueBlock === undefined) throw new Error("Assertion failed; invalid value");

            const varDefinition = assignmentSymbol.getVarDefinitionReference(stack.sprite, uniqueIds, existingTypes, errorCollector);

            if (valueBlock instanceof Definition) {
                const copyInputs = valueBlock.generateInputs(uniqueIds);
                if (type.size !== copyInputs.length) throw new Error("Assertion failed; invalid inputs generated");
                for (let i = 0; i < type.size; i++) {
                    stack.orderedStackBlocks.push(...varDefinition.generateSetValueAtOffset(uniqueIds, copyInputs[i], i));
                }
            } else if (valueBlock instanceof Value) {
                stack.orderedStackBlocks.push(...varDefinition.generateSetValueAtOffset(uniqueIds, valueBlock, 0));
            } else {
                throw new Error("Assertion failed; invalid value");
            }
        } else if (block instanceof KeywordExpression) {
            const symbol = this.getIdentifierReference(block.keyword);
            if (symbol instanceof ProcedureSymbol) {
                // todo: return function reference
            } else if (symbol instanceof VariableSymbol) {
                return symbol.getVarDefinitionReference(stack.sprite, uniqueIds, existingTypes, errorCollector);
            } else if (symbol instanceof ParameterSymbol) {
                const paramDefinition = paramRedefinitions.get(symbol);
                if (paramDefinition === undefined) throw new Error("Assertion failed; param definition not found?");

                return paramDefinition;
            }
        } else if (block instanceof AccessorExpression) {
            const baseType = inferExpressionType(block.base, this, existingTypes, errorCollector);
            if (!(baseType instanceof ClassInstanceType)) throw new Error("Assertion failed; type has no properties");
            
            const base = this.traverseAndGenerateBlocksForCodeBlock(block.base, stack, paramRedefinitions, uniqueIds, existingTypes, errorCollector);
            if (!(base instanceof Definition)) throw new Error("Assertion failed; type has no properties");

            const compositeDefinition = new CompositeDefinition(baseType, [ base ]);
            return compositeDefinition.narrowCompositeToProperty(block.property.keyword);
        } else if (block instanceof StructFieldsExpression) {
            const structType = inferExpressionType(block, this, existingTypes, errorCollector);
            if (!(structType instanceof ClassInstanceType)) throw new Error("Assertion failed; type cannot be instantiated as struct");

            return this.definePresetForTypeStructInstantiationImpl(structType, block, stack, paramRedefinitions, uniqueIds, existingTypes, errorCollector);
        } else if (block instanceof NumberExpression) {
            return new NumberValue(parseFloat(block.unprocessedNumber));
        } else if (block instanceof StringExpression) {
            return new StringValue(block.text);
        }

        throw new Error(`Cannot generate blocks for expression: ${ExpressionKind[block.kind]}`);
    }

    generateBlocks(sprite: Sprite, uniqueIds: IdGenerator, existingTypes: ExistingTypes, errorCollector: ErrorCollector) {
        const procType = getProcedureSignature(this, existingTypes, errorCollector)
        if (this.expression instanceof ScriptExpression) throw new Error("Assertion failed; cannot create blocks on root script");
        if (procType.functionSymbol === undefined || this.expression.block === undefined ) throw new Error("Assertion failed; cannot generate blocks for procedure type declaration");

        const stack = sprite.createStack();
        const paramDefinitions: ParameterDefinition[] = [];
        const paramRedefinitions: Map<ParameterSymbol, CompositeDefinition> = new Map;
        for (const param of procType.params) {
            if (param.parameterSymbol === undefined) throw new Error("Assertion failed; cannot generate blocks for parameter type declaration");
            const params = ParameterDefinition.defineParametersForType(param.parameterSymbol.name, param.type, uniqueIds);
            if (param.parameterSymbol.flags.has(SymbolFlag.ParamReassigned)) {
                const redefinition = params.createRedefinition(uniqueIds, "mut:" + param.parameterSymbol.name, sprite);
                paramRedefinitions.set(param.parameterSymbol, redefinition);
                
                const getValues = params.generateInputs(uniqueIds);
                const setValue = redefinition.generateIntantiation(uniqueIds, getValues);
                stack.orderedStackBlocks.push(...setValue);
            } else {
                paramRedefinitions.set(param.parameterSymbol, params);
            }
            paramDefinitions.push(...params.deepTraverseComponents() as ParameterDefinition[]);
        }

        const proccode = this.getProcCode(uniqueIds, existingTypes, errorCollector);
        const parameterIds = this.getParameterIds(uniqueIds, existingTypes, errorCollector);
        
        const prototypeBlock = new Block(
            uniqueIds.nextId(),
            "procedures_prototype",
            Object.fromEntries(
                parameterIds.map((id, i) => {
                    return [ id, new Shadowed(undefined, paramDefinitions[i].generateInputAtOffset(uniqueIds, 0)) ];
                })
            ),
            { },
            true, false,
            {
                tagName: "mutation",
                children: [],
                proccode: proccode,
                argumentids: JSON.stringify(parameterIds),
                argumentnames: JSON.stringify(paramDefinitions.map(x => x.name)),
                argumentdefaults: JSON.stringify(parameterIds.map(() => "")),
                warp: "true" 
            }
        );
        const definitionBlock = new Block(
            uniqueIds.nextId(),
            "procedures_definition",
            { custom_block: new Shadowed(undefined, new BlockRef(prototypeBlock)) },
            { },
            false, true
        );

        this.traverseAndGenerateBlocksForCodeBlock(this.expression.block, stack, paramRedefinitions, uniqueIds, existingTypes, errorCollector);

        sprite.applyStack(stack, definitionBlock);
        // console.log(sprite.blocks);
    }
}