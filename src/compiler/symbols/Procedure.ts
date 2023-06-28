import { ErrorCollector } from "../../errorCollector";
import { AccessorExpression, AssignmentExpression, Expression, ExpressionKind, FunctionCallExpression, KeywordExpression, NumberExpression, OperatorExpression, ParenthesisExpression, ProcDeclarationExpression, ReturnStatementExpression, ScriptExpression, StringExpression, StructFieldsExpression, VariableDeclarationExpression } from "../../expression";
import { ExistingTypes } from "../ExistingTypes";
import { IdGenerator } from "../IdGenerator";
import { staticallyAnalyseExpressionDeclaration } from "../analysis";
import { BroadcastDefinition, CompositeDefinition, ListDefinition, ParameterDefinition, PresetDefinition, Sprite, Stack, VariableDefinition } from "../definitions";
import { getProcedureSignature, resolveSymbolType } from "../resolveSymbolType";
import { SymbolDeclarationStore } from "../symbolDeclarationStore";
import { ClassSymbol } from "./Class";
import { MacroSymbol } from "./Macro";
import { ParameterSymbol } from "./Parameter";
import { ScopedSymbol, SymbolFlag, SymbolType } from "./Symbol";
import { Block, BlockInput, BlockRef, BroadcastValue, NumberValue, Shadowed, StringValue, Value } from "../../scratch";
import { Definition } from "../definitions/Definition";
import { VariableSymbol } from "./Variable";
import { inferExpressionType } from "../inferExpressionType";
import { ClassInstanceType, ProcedureSignatureType, Type } from "../types";

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
    
    protected _cachedBroadcastReference: BroadcastDefinition|undefined;
    protected _cachedReturnVariable: Definition|undefined;
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

        return signature.functionSymbol!.name + " " + parameterIds.map(() => "%s").join(" ");
    }

    getOrCreateBroadcastReference(uniqueIds: IdGenerator) {
        if (this._cachedBroadcastReference !== undefined) return this._cachedBroadcastReference;

        this._cachedBroadcastReference = new BroadcastDefinition(this.name + "-" + uniqueIds.nextId(), uniqueIds.nextId());
        return this._cachedBroadcastReference;
    }

    createDefinitionForType(type: Type, name: string, uniqueIds: IdGenerator, sprite: Sprite) {
        // if (type.size > 1) {
        //     const variables = [];
        //     for (let i = 0; i < type.size; i++) variables.push(sprite.createVariable(uniqueIds.nextId(), "<-" + this.name + "_" + i));
        //     const composite = new CompositeDefinition(type, variables);
        //     this._cachedReturnVariable = composite;
        //     return composite;
        // }

        const definition = type.size > 1
            ? sprite.createList(uniqueIds.nextId(), name, type.size)
            : sprite.createVariable(uniqueIds.nextId(), name);

        return definition;
    }

    getOrCreateReturnValueReference(uniqueIds: IdGenerator, existingTypes: ExistingTypes, sprite: Sprite, errorCollector: ErrorCollector) {
        if (this._cachedReturnVariable !== undefined) return this._cachedReturnVariable;

        const typeSignature = getProcedureSignature(this, existingTypes, errorCollector);
        const definition = this.createDefinitionForType(typeSignature.returnType, "<-" + this.name, uniqueIds, sprite);;
        this._cachedReturnVariable = definition;
        return definition;
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

            if (structField === undefined) throw new Error(`Assertion failed; field '${field.fieldSymbol.name}' not found in type instantiation`);

            const valueType = inferExpressionType(structField.value, this, existingTypes, errorCollector);
            if (!valueType.isEquivalentTo(field.type)) throw new Error(`Assertion failed; invalid field type '${field.fieldSymbol.name}`);
            
            const value = this.traverseAndGenerateBlocksForCodeBlock(structField.value, stack, paramRedefinitions, uniqueIds, existingTypes, errorCollector);
            if (value === undefined) throw new Error(`Assertion failed; invalid field type '${field.fieldSymbol.name}`);

            composite.push(value);
        }
        return new CompositeDefinition(type, composite);
    }

    generateCopyFromTo(type: Type, from: Definition, to: Definition, stack: Stack, uniqueIds: IdGenerator) {
        if (to instanceof PresetDefinition) throw new Error("Cannot copy to value");
        const copyInputs = from.generateInputs(uniqueIds);
        if (type.size !== copyInputs.length) throw new Error("Assertion failed; invalid inputs generated");
        stack.orderedStackBlocks.push(...to.generateIntantiation(uniqueIds, copyInputs));
    }

    createProcedureCallBlock(parameters: BlockInput[], uniqueIds: IdGenerator, existingTypes: ExistingTypes, errorCollector: ErrorCollector) {
        const parameterIds = this.getParameterIds(uniqueIds, existingTypes, errorCollector);
        const procCode = this.getProcCode(uniqueIds, existingTypes, errorCollector);
        return new Block(uniqueIds.nextId(), "procedures_call",
            Object.fromEntries(parameterIds.map((parameterId, i) => {
                const parameterAccess = parameters[i];
                if (parameterAccess === undefined) throw new Error(`Missing parameter ${i}`);
                return [ parameterId, new Shadowed(undefined, parameterAccess) ];
            })), { }, false, false, {
            tagName: "mutation",
            children: [],
            proccode: procCode,
            argumentids: JSON.stringify(parameterIds),
            warp: "true"
        });
    }

    protected getOperatorOpcode(operator: string) {
        switch (operator) {
        case "+": return "operator_add";
        case "-": return "operator_subtract";
        case "*": return "operator_multiply";
        case "/": return "operator_divide";
        }
    }

    createBlockForOperator(uniqueIds: IdGenerator, operator: string, left: Definition, right: Definition) {
        const opcode = this.getOperatorOpcode(operator);
        if (opcode === undefined) throw new Error(`Assertion failed; unknown operator ${operator}`);
        switch (operator) {
        case "+":
        case "-":
        case "*":
        case "/":
            return new Block(uniqueIds.nextId(), opcode, {
                NUM1: new Shadowed(undefined, left.generateInputAtOffset(uniqueIds, 0)), NUM2: new Shadowed(undefined, right.generateInputAtOffset(uniqueIds, 0))
            });
        }
        throw new Error(`Assertion failed; unknown operator ${operator}`);
    }

    traverseAndGenerateBlocksForCodeBlock(
        block: Expression,
        stack: Stack,
        paramRedefinitions: Map<ParameterSymbol, CompositeDefinition>,
        uniqueIds: IdGenerator,
        existingTypes: ExistingTypes,
        errorCollector: ErrorCollector
    ): Definition|undefined {
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

            const assignmentDefinition = this.traverseAndGenerateBlocksForCodeBlock(block.reference, stack, paramRedefinitions, uniqueIds, existingTypes, errorCollector);
            if (!(assignmentDefinition instanceof Definition)) throw new Error("Assertion failed; invalid assignment reference");

            const valueBlock = this.traverseAndGenerateBlocksForCodeBlock(block.value, stack, paramRedefinitions, uniqueIds, existingTypes, errorCollector);
            if (valueBlock === undefined) throw new Error("Assertion failed; invalid value");;

            this.generateCopyFromTo(assignmentType, valueBlock, assignmentDefinition, stack, uniqueIds);
            return assignmentDefinition;
        } else if (block instanceof VariableDeclarationExpression) {
            const assignmentSymbol = this.getIdentifierReference(block.identifier);
            if (!(assignmentSymbol instanceof VariableSymbol)) throw new Error("Assertion failed; identifier not a variable");

            const type = resolveSymbolType(assignmentSymbol, existingTypes, errorCollector);
            const initialValueType = inferExpressionType(block.initialValue, this, existingTypes, errorCollector);
            if (!initialValueType.isEquivalentTo(type)) throw new Error("Assertion failed; invalid type of expression");

            const varDefinition = assignmentSymbol.getVarDefinitionReference(stack.sprite, uniqueIds, existingTypes, errorCollector);

            const valueBlock = this.traverseAndGenerateBlocksForCodeBlock(block.initialValue, stack, paramRedefinitions, uniqueIds, existingTypes, errorCollector);
            if (valueBlock === undefined) throw new Error("Assertion failed; invalid value");;

            this.generateCopyFromTo(type, valueBlock, varDefinition, stack, uniqueIds);
            return;
        } else if (block instanceof KeywordExpression) {
            const symbol = this.getIdentifierReference(block.keyword);
            if (symbol instanceof ProcedureSymbol) {
                if (!symbol.flags.has(SymbolFlag.ProcUsedAsValue)) throw new Error("Assertion failed; proc used as value yet has no flag for such - broadcast may not exist");
                const broadcastReference = symbol.getOrCreateBroadcastReference(uniqueIds);
                return new PresetDefinition(new StringValue(broadcastReference.name));
            } else if (symbol instanceof VariableSymbol) {
                return symbol.getVarDefinitionReference(stack.sprite, uniqueIds, existingTypes, errorCollector);
            } else if (symbol instanceof ParameterSymbol) {
                const paramDefinition = paramRedefinitions.get(symbol);
                if (paramDefinition === undefined) throw new Error("Assertion failed; param definition not found?");

                return paramDefinition;
            }
        } else if (block instanceof FunctionCallExpression) {
            if (block.reference instanceof KeywordExpression) {
                const immediateSymbol = this.getIdentifierReference(block.reference.keyword);
                if (immediateSymbol instanceof ProcedureSymbol) {
                    const paramInputs: BlockInput[] = [];
                    const procedureSignature = getProcedureSignature(immediateSymbol, existingTypes, errorCollector);
                    for (let i = 0; i < block.args.length; i++) {
                        const paramSignature = procedureSignature.params[i];
                        const argType = inferExpressionType(block.args[i], this, existingTypes, errorCollector);
                        if (!paramSignature.type.isEquivalentTo(argType)) throw new Error(`Assertion failed; invalid param ${i}`);

                        const argBlock = this.traverseAndGenerateBlocksForCodeBlock(block.args[i], stack, paramRedefinitions, uniqueIds, existingTypes, errorCollector);
                        if (argBlock === undefined) throw new Error(`Assertion failed; invalid param ${i}`);
                        paramInputs.push(...argBlock.generateInputs(uniqueIds));
                    }
                    
                    const callBlock = immediateSymbol.createProcedureCallBlock(paramInputs, uniqueIds, existingTypes, errorCollector);
                    stack.orderedStackBlocks.push(callBlock);

                    const returnValueReference = immediateSymbol.getOrCreateReturnValueReference(uniqueIds, existingTypes, stack.sprite, errorCollector);
                    const auxReturn = this.createDefinitionForType(procedureSignature.returnType, uniqueIds.nextId(), uniqueIds, stack.sprite);
                    this.generateCopyFromTo(procedureSignature.returnType, returnValueReference, auxReturn, stack, uniqueIds);
                    return auxReturn;
                }
            }

            const broadcastReferenceValue = this.traverseAndGenerateBlocksForCodeBlock(block.reference, stack, paramRedefinitions, uniqueIds, existingTypes, errorCollector);
            const referenceType = inferExpressionType(block.reference, this, existingTypes, errorCollector);
            if (broadcastReferenceValue === undefined || !(referenceType instanceof ProcedureSignatureType))
                throw new Error("Assertion failed; reference is not a function to call");
            
            const globalArgsProxy = stack.sprite.createGlobal("args-proxy", () => stack.sprite.createList(uniqueIds.nextId(), "#args", 999));
            const globalReturnProxyFull = stack.sprite.createGlobal("return-proxy", () => stack.sprite.createList(uniqueIds.nextId(), "#return", 999));

            // hack to get unsized array (max size 999) and only take what we need
            const globalReturnProxy = globalReturnProxyFull.sliceAtOffset(0, referenceType.returnType.size);
            
            const args: BlockInput[] = [];
            let offset = 0;
            for (let i = 0; i < block.args.length; i++) {
                const paramSignature = referenceType.params[i];
                const argType = inferExpressionType(block.args[i], this, existingTypes, errorCollector);
                if (!paramSignature.type.isEquivalentTo(argType)) throw new Error(`Assertion failed; invalid param ${i}`);

                const argBlock = this.traverseAndGenerateBlocksForCodeBlock(block.args[i], stack, paramRedefinitions, uniqueIds, existingTypes, errorCollector);
                if (argBlock === undefined) throw new Error(`Assertion failed; invalid param ${i}`);

                args.push(...argBlock.generateInputs(uniqueIds));
                offset += paramSignature.type.size;
            }

            stack.orderedStackBlocks.push(...globalArgsProxy.generateIntantiation(uniqueIds, args, false));

            const broadcastCompleted = stack.sprite.createGlobal("completed-proxy", () => stack.sprite.createVariable(uniqueIds.nextId(), "$completed"));
            stack.orderedStackBlocks.push(...broadcastCompleted.generateSetValueAtOffset(uniqueIds, new NumberValue(0), 0));

            const broadcastRefInput = broadcastReferenceValue.generateInputAtOffset(uniqueIds, 0);
            if (broadcastRefInput instanceof BlockRef) broadcastRefInput.block.shadow = false; // force shadow for broadcast input block
            const broadcastBlock = new Block(uniqueIds.nextId(), "event_broadcast", {
                BROADCAST_INPUT: new Shadowed(new BroadcastValue("", ""), broadcastRefInput)
            });
            stack.orderedStackBlocks.push(broadcastBlock);

            const conditionCheck = new Block(uniqueIds.nextId(), "operator_equals", {
                OPERAND1: new Shadowed(undefined, broadcastCompleted.generateInputAtOffset(uniqueIds, 0)),
                OPERAND2: new Shadowed(undefined, new NumberValue(1))
            });
            
            const whileStack = stack.sprite.createStack();
            const noOpBlockAux = new Block(uniqueIds.nextId(), "sound_volume");
            const noOpBlock = new Block(uniqueIds.nextId(), "sound_setvolumeto", {
                VOLUME: new Shadowed(undefined, new BlockRef(noOpBlockAux))
            });
            whileStack.orderedStackBlocks.push(noOpBlock);

            const repeatUntil = new Block(uniqueIds.nextId(), "control_repeat_until", {
                CONDITION: new Shadowed(undefined, new BlockRef(conditionCheck)),
                SUBSTACK: new Shadowed(undefined, new BlockRef(noOpBlock))
            });

            stack.sprite.applyStack(whileStack);
            stack.orderedStackBlocks.push(repeatUntil);

            const auxReturn = this.createDefinitionForType(referenceType.returnType, uniqueIds.nextId(), uniqueIds, stack.sprite);
            this.generateCopyFromTo(referenceType.returnType, globalReturnProxy, auxReturn, stack, uniqueIds);
            return auxReturn;
        } else if (block instanceof ReturnStatementExpression) {
            if (block.expression === undefined) return;
            const procSignature = getProcedureSignature(this, existingTypes, errorCollector);
            const expressionSignature = inferExpressionType(block.expression, this, existingTypes, errorCollector);

            if (!procSignature.returnType.isEquivalentTo(expressionSignature)) throw new Error(`Assertion failed; invalid return value`);

            const returnValueDefinition = this.getOrCreateReturnValueReference(uniqueIds, existingTypes, stack.sprite, errorCollector);
            const expressionDefinition = this.traverseAndGenerateBlocksForCodeBlock(block.expression, stack, paramRedefinitions, uniqueIds, existingTypes, errorCollector);
            if (expressionDefinition === undefined) throw new Error(`Assertion failed; invalid return value`);
            this.generateCopyFromTo(procSignature.returnType, expressionDefinition, returnValueDefinition, stack, uniqueIds);
            return;
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
        } else if (block instanceof OperatorExpression) {
            const leftBlock = this.traverseAndGenerateBlocksForCodeBlock(block.left, stack, paramRedefinitions, uniqueIds, existingTypes, errorCollector);
            const rightBlock = this.traverseAndGenerateBlocksForCodeBlock(block.right, stack, paramRedefinitions, uniqueIds, existingTypes, errorCollector);

            if (leftBlock === undefined) throw new Error("Assertion failed; invalid left-hand operand");
            if (rightBlock === undefined) throw new Error("Assertion failed; invalid right-hand operand");

            const opcodeBlock = this.createBlockForOperator(uniqueIds, block.operator, leftBlock, rightBlock);
            return new PresetDefinition(new BlockRef(opcodeBlock));
        } else if (block instanceof NumberExpression) {
            return new PresetDefinition(new NumberValue(parseFloat(block.unprocessedNumber)));
        } else if (block instanceof StringExpression) {
            return new PresetDefinition(new StringValue(block.text));
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
        
        const prototypeBlock = new Block(uniqueIds.nextId(), "procedures_prototype",
            Object.fromEntries(
                parameterIds.map((id, i) => {
                    return [ id, new Shadowed(undefined, paramDefinitions[i].generateInputAtOffset(uniqueIds, 0)) ];
                })
            ), { }, true, false, {
            tagName: "mutation",
            children: [],
            proccode: proccode,
            argumentids: JSON.stringify(parameterIds),
            argumentnames: JSON.stringify(paramDefinitions.map(x => x.name)),
            argumentdefaults: JSON.stringify(parameterIds.map(() => "")),
            warp: "true" 
         });
        const definitionBlock = new Block(uniqueIds.nextId(), "procedures_definition", {
            custom_block: new Shadowed(undefined, new BlockRef(prototypeBlock))
        }, { }, false, true);
        
        if (this.flags.has(SymbolFlag.ProcUsedAsValue)) {
            const stack = sprite.createStack();
            const broadcastReference = this.getOrCreateBroadcastReference(uniqueIds);

            const broadcastHat = new Block(uniqueIds.nextId(), "event_whenbroadcastreceived", { },{
                BROADCAST_OPTION: [ broadcastReference.name, broadcastReference.id ]
            }, false, true);

            const globalArgsProxy = sprite.createGlobal("args-proxy", () => sprite.createList(uniqueIds.nextId(), "#args", 999));
            const globalReturnProxy = sprite.createGlobal("return-proxy", () => sprite.createList(uniqueIds.nextId(), "#return", 999));
            const accesses: BlockInput[] = [];
            let offset = 0;
            for (const paramSignature of procType.params) {
                const paramStruct = globalArgsProxy.sliceAtOffset(offset, paramSignature.type.size);
                const compositeDefinition = new CompositeDefinition(paramSignature.type, [ paramStruct ]);
                accesses.push(...compositeDefinition.generateInputs(uniqueIds));
                offset += paramSignature.type.size;
            }
            const procCall = this.createProcedureCallBlock(accesses, uniqueIds, existingTypes, errorCollector);
            stack.orderedStackBlocks.push(procCall);

            const returnValue = this.getOrCreateReturnValueReference(uniqueIds, existingTypes, stack.sprite, errorCollector);
            stack.orderedStackBlocks.push(...globalReturnProxy.generateIntantiation(uniqueIds, returnValue.generateInputs(uniqueIds), false));

            const broadcastCompleted = stack.sprite.createGlobal("completed-proxy", () => stack.sprite.createVariable(uniqueIds.nextId(), "$completed"));
            stack.orderedStackBlocks.push(...broadcastCompleted.generateSetValueAtOffset(uniqueIds, new NumberValue(1), 0));

            sprite.applyStack(stack, broadcastHat);
        }

        this.traverseAndGenerateBlocksForCodeBlock(this.expression.block, stack, paramRedefinitions, uniqueIds, existingTypes, errorCollector);

        sprite.applyStack(stack, definitionBlock);
        // console.log(sprite.blocks);
    }
}