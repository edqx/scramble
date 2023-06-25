import { ErrorCollector } from "../errorCollector";
import { ParenthesisExpression, ProcDeclarationExpression } from "../expression";
import { Block, BlockRef, Shadowed } from "../scratch";
import { IdGenerator } from "./IdGenerator";
import { CodeSymbol, ProcedureSymbol, SymbolFlag } from "./definitions";
import { ClassInstanceType, FunctionType, TypeSignature, resolveSymbolType } from "./outline";

export function expandProcedureArguments(
    idGenerator: IdGenerator,
    parentName: string,
    parameter: ClassInstanceType,
    existingTypes: Map<CodeSymbol, TypeSignature>,
    compilerErrors: ErrorCollector
): Block[] {
    const args = [];
    for (const [ , field ] of parameter.fields) {
        if (field.type instanceof ClassInstanceType) {
            args.push(...expandProcedureArguments(
                idGenerator,
                parentName + "_" + field.fieldSymbol.name,
                parameter, existingTypes,
                compilerErrors
            ));
        } else {
            args.push(
                new Block(
                    idGenerator.nextId(),
                    "argument_reporter_string_number",
                    {},
                    {
                        VALUE: [ parentName + "_" + field.fieldSymbol.name, null ]
                    },
                    true,
                    false
                )
            );
        }
    }

    return args;
}

export function generateProcedureDefinition(
    idGenerator: IdGenerator,
    proc: ProcedureSymbol,
    existingTypes: Map<CodeSymbol, TypeSignature>,
    variables: Map<string, [ string, any ]>,
    lists: Map<string, [ string, string[] ]>,
    broadcasts: Map<string, string>,
    compilerErrors: ErrorCollector
) {
    if (!(proc.expression instanceof ProcDeclarationExpression) || !proc.expression.isCodeDefinition())
        throw new Error("Bad procedure definition");
    
    const typeSignature = resolveSymbolType(proc, existingTypes, compilerErrors);

    if (!(typeSignature instanceof FunctionType))
        throw new Error("Bad procedure definition");

    const accessAliases: Map<string, string> = new Map;
    const argumentDefinitions: Block[] = [];
    const innerBlocks: Block[] = [];
    const stack: Block[] = [];
    for (const parameter of typeSignature.params) {
        if (parameter.parameterSymbol === undefined)
            continue;
        
        if (parameter.type instanceof ClassInstanceType) {
            const args = expandProcedureArguments(idGenerator, parameter.parameterSymbol!.name, parameter.type, existingTypes, compilerErrors);
            argumentDefinitions.push(...args);
            if (parameter.parameterSymbol!.flags.has(SymbolFlag.ParamReassigned)) {
                const varId = idGenerator.nextId();
                if (parameter.type.size > 1) {
                    lists.set(varId, [ "mut:" + parameter.parameterSymbol.name, [ ] ]);
                    stack.push(
                        new Block(
                            idGenerator.nextId(),
                            "data_deletealloflist",
                            { },
                            {
                                LIST: [
                                    "mut:" + parameter.parameterSymbol.name,
                                    varId
                                ]
                            }
                        )
                    );
                    for (const arg of args) {
                        const paramName = arg.fields.VALUE[0];
                        const argumentReference = new Block(
                            idGenerator.nextId(),
                            "argument_reporter_string_number",
                            { },
                            {
                                VALUE: [ paramName, null ]
                            }
                        );
                        const setVarTo = new Block(
                            idGenerator.nextId(),
                            "data_addtolist",
                            {
                                ITEM: new Shadowed(undefined, new BlockRef(argumentReference.id))
                            },
                            {
                                LIST: [
                                    "mut:" + paramName,
                                    varId
                                ]
                            }
                        );
                        argumentReference.setParentId(setVarTo.id);
                        stack.push(setVarTo);
                        innerBlocks.push(argumentReference);
                    }
                } else {
                    variables.set(varId, [ "mut:" + parameter.parameterSymbol.name, "" ]);
                    const argName = args[0].fields.VALUE[0];
                    const argumentReference = new Block(
                        idGenerator.nextId(),
                        "argument_reporter_string_number",
                        { },
                        {
                            VALUE: [ argName, null ]
                        }
                    );
                    const setVarTo = new Block(
                        idGenerator.nextId(),
                        "data_setvariableto",
                        {
                            VALUE: new Shadowed(undefined, new BlockRef(argumentReference.id))
                        },
                        {
                            VARIABLE: [
                                "mut:" + argName,
                                varId
                            ]
                        }
                    );
                    argumentReference.setParentId(setVarTo.id);
                    stack.push(setVarTo);
                    innerBlocks.push(argumentReference);
                }
                accessAliases.set(parameter.parameterSymbol!.id, varId);
            }
        } else {
            const arg = new Block(
                idGenerator.nextId(),
                "argument_reporter_string_number",
                {},
                {
                    VALUE: [ parameter.parameterSymbol.name, null ]
                },
                true,
                false
            );
            argumentDefinitions.push(arg);
            
            if (parameter.parameterSymbol.flags.has(SymbolFlag.ParamReassigned)) {
                const varId = idGenerator.nextId();
                variables.set(varId, [ "mut:" + parameter.parameterSymbol.name, "" ]);
                const argumentReference = new Block(
                    idGenerator.nextId(),
                    "argument_reporter_string_number",
                    { },
                    {
                        VALUE: [ parameter.parameterSymbol.name, null ]
                    }
                );
                const setVarTo = new Block(
                    idGenerator.nextId(),
                    "data_setvariableto",
                    {
                        VALUE: new Shadowed(undefined, new BlockRef(argumentReference.id))
                    },
                    {
                        VARIABLE: [
                            "mut:" + parameter.parameterSymbol.name,
                            varId
                        ]
                    }
                );
                argumentReference.setParentId(setVarTo.id);
                stack.push(setVarTo);
                innerBlocks.push(argumentReference);
            }
        }
    }

    // the argument IDs are NOT equal to the definition block IDs calculated above
    const argumentIds = argumentDefinitions.map(x => idGenerator.nextId());

    const procedurePrototype = new Block(
        idGenerator.nextId(),
        "procedures_prototype",
        Object.fromEntries(
            argumentIds.map((id, i) => {
                return [ id, new Shadowed(undefined, new BlockRef(argumentDefinitions[i].id)) ];
            })
        ),
        { },
        true,
        false,
        {
            tagName: "mutation",
            children: [],
            proccode: proc.name + " " + argumentIds.map(arg => "%s").join(" "),
            argumentids: JSON.stringify(argumentIds),
            argumentnames: JSON.stringify(argumentDefinitions.map(x => x.fields.VALUE[0])),
            argumentdefaults: JSON.stringify(argumentIds.map(x => "")),
            warp: "true"
        }
    )

    const procedureDefinition = new Block(
        idGenerator.nextId(),
        "procedures_definition",
        {
            custom_block: new Shadowed(undefined, new BlockRef(procedurePrototype.id))
        },
        { },
        false,
        true
    );

    procedurePrototype.setParentId(procedureDefinition.id);
    for (const definition of argumentDefinitions) {
        definition.setParentId(procedurePrototype.id);
    }

    if (stack.length > 0) {
        procedureDefinition.setNextId(stack[0].id);
        stack[0].setParentId(procedureDefinition.id);
        for (let i = 1; i < stack.length; i++) {
            stack[i - 1].setNextId(stack[i].id);
            stack[i].setParentId(stack[i - 1].id);
        }
    }

    if (proc.expression.block instanceof ParenthesisExpression) {
        for (const expr of proc.expression.block) {
            
        }
    } else {

    }

    return [ procedureDefinition, procedurePrototype, ...argumentDefinitions, ...stack, ...innerBlocks ];
}