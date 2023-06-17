import { parseAst, parseSingleTokenAst } from "../ast";
import { AstCollector } from "../astCollector";
import { ErrorCollector } from "../errorCollector";
import { CompilerError, ErrorCode } from "../errors";
import { FilePositionRange } from "../stringReader";
import { KeywordToken, NewlineToken, OpenParenthesisToken, StatementBreakToken, Token } from "../token";
import { TokenReader } from "../tokenReader";
import { AccessorExpression } from "./Accessor";
import { AssignmentExpression } from "./Assignment";
import { Expression, ExpressionKind } from "./Expression";
import { KeywordExpression } from "./Keyword";
import { ParameterDeclarationExpression } from "./ParameterDeclaration";
import { ParenthesisExpression } from "./Parenthesis";
import { TypeGuardExpression } from "./TypeGuard";

export class ProcDeclarationExpression extends Expression {
    protected static readReturnStatement(tokenReader: TokenReader, errorCollector: ErrorCollector) {
        const blockAst = new AstCollector;
        while (true) {
            const nextToken = tokenReader.getNextToken();
            
            if (nextToken === undefined) return blockAst;

            if (nextToken instanceof NewlineToken || nextToken instanceof StatementBreakToken)
                return blockAst;
            
            parseSingleTokenAst(nextToken, blockAst, tokenReader, errorCollector);
        }
    }

    static parseParameters(procKeyword: Expression|Token, parameterExpressions: Expression[], errorCollector: ErrorCollector) {
        const parameterDeclarations: ParameterDeclarationExpression[] = [];
        for (const parameterExpression of parameterExpressions) {
            if (parameterExpression instanceof AssignmentExpression) {
                if (parameterExpression.reference instanceof AccessorExpression) {
                    errorCollector.addError(
                        new CompilerError(ErrorCode.InvalidParameterDeclaration)
                            .addError(parameterExpression.position, "Invalid parameter declaration")
                            .addInfo(parameterExpression.reference.position, "The name of a parameter must be a single identifier")
                    );
                    continue;
                }

                parameterDeclarations.push(new ParameterDeclarationExpression(parameterExpression.reference, parameterExpression.type, parameterExpression.value));
            } else if (parameterExpression instanceof TypeGuardExpression) {
                parameterDeclarations.push(new ParameterDeclarationExpression(parameterExpression.identifier, parameterExpression.type, undefined));
            } else if (parameterExpression instanceof KeywordExpression) {
                parameterDeclarations.push(new ParameterDeclarationExpression(parameterExpression, undefined, undefined));
            } else {
                errorCollector.addError(
                    new CompilerError(ErrorCode.InvalidParameterDeclaration)
                        .addError(parameterExpression.position, "Invalid parameter declaration")
                        .addInfo(procKeyword.position, "Parameters for proc and macro declarations can only have identifiers, as well as type guards and default values")
                );
            }
        }
        return parameterDeclarations;
    }

    static read(procKeywordToken: KeywordToken, astCollector: AstCollector, tokenReader: TokenReader, errorCollector: ErrorCollector) {
        const identifierToken = tokenReader.getNextToken();
        if (identifierToken === undefined) throw new Error("Unexpected EOF");
        if (!(identifierToken instanceof KeywordToken)) throw new Error("Invalid proc identifier");
        
        tokenReader.moveNextWhile(token => token instanceof NewlineToken);
        const paramsStartToken = tokenReader.getNextToken();
        if (identifierToken === undefined) throw new Error("Unexpected EOF");
        if (!(paramsStartToken instanceof OpenParenthesisToken)) throw new Error("Expected proc parameter list");

        const parametersAst = new AstCollector;
        ParenthesisExpression.read(paramsStartToken, parametersAst, tokenReader, errorCollector);

        const parametersList = parametersAst.getPrimeExpression()!;
        if (!(parametersList instanceof ParenthesisExpression)) throw new Error("Expected proc parameter list");

        tokenReader.moveNextWhile(token => token instanceof NewlineToken);
        const block = tokenReader.getNextToken();
        if (block instanceof KeywordToken) {
            if (block.keyword === "return") {
                const blockAst = new AstCollector;
                parseSingleTokenAst(block, blockAst, tokenReader, errorCollector);
                astCollector.appendExpression(
                    new ProcDeclarationExpression(
                        identifierToken, 
                        this.parseParameters(
                            procKeywordToken,
                            parametersList.expressions,
                            errorCollector
                        ),
                        blockAst.getPrimeExpression()!
                    )
                );
                return;
            }
            throw new Error("Expected code block or 'return' statement");
        } else if (block instanceof OpenParenthesisToken && block.parenthesis === "{") {
            const blockAst = new AstCollector;
            parseSingleTokenAst(block, blockAst, tokenReader, errorCollector);
            astCollector.appendExpression(
                new ProcDeclarationExpression(
                    identifierToken,
                    this.parseParameters(procKeywordToken, parametersList.expressions, errorCollector),
                    blockAst.getPrimeExpression()!
                )
            );
        }
    }

    identifier: string;
    constructor(identifier: KeywordToken, public readonly parameters: ParameterDeclarationExpression[], public readonly block: Expression) {
        super(ExpressionKind.ProcDeclaration, FilePositionRange.contain(identifier.position, block.position));
        this.identifier = identifier.keyword;
    }
}