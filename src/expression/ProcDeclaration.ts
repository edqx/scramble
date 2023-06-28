import { parseAst, parseSingleTokenAst } from "../parseAst";
import { AstCollector } from "../astCollector";
import { ErrorCollector } from "../errorCollector";
import { CompilerError, ErrorCode } from "../error";
import { FilePositionRange } from "../stringReader";
import { KeywordToken, NewlineToken, OpenParenthesisToken, ReturnTypeIndicatorToken, StatementBreakToken, Token } from "../token";
import { TokenReader } from "../tokenReader";
import { AccessorExpression } from "./Accessor";
import { AssignmentExpression } from "./Assignment";
import { Expression, ExpressionKind } from "./Expression";
import { KeywordExpression } from "./Keyword";
import { ParameterDeclarationExpression } from "./ParameterDeclaration";
import { ParenthesisExpression } from "./Parenthesis";
import { ReturnStatementExpression } from "./ReturnStatement";
import { TypeGuardExpression } from "./TypeGuard";
import { ReturnTypeIndicatorExpression } from "./ReturnTypeIndicator";

export class ProcDeclarationExpression extends Expression {
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
                parameterDeclarations.push(new ParameterDeclarationExpression(parameterExpression.reference, parameterExpression.type, undefined));
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

    static readCodeBlock(procKeywordToken: KeywordToken, lastExpression: Expression, astCollector: AstCollector, tokenReader: TokenReader, errorCollector: ErrorCollector) {
        tokenReader.moveNextWhile(match => match instanceof NewlineToken);
        const blockToken = tokenReader.getNextToken();
        if (blockToken instanceof KeywordToken) {
            if (blockToken.keyword === "return") {
                ReturnStatementExpression.read(blockToken, astCollector, tokenReader, errorCollector);
                return astCollector.popLastExpression()!;
            }
        } else if (blockToken instanceof OpenParenthesisToken && blockToken.parenthesis === "{") {
            ParenthesisExpression.read(blockToken, astCollector, tokenReader, errorCollector);
            return astCollector.popLastExpression()!;
        } else {
            errorCollector.addError(
                new CompilerError(ErrorCode.ExpectedParameters)
                    .addError(blockToken?.position ?? lastExpression.position.end.offset(1), "Expected code block")
                    .addInfo(procKeywordToken.position, "Procedure code declaration requires a block or a 'return' keyword")
            );
            return undefined;
        }
    }

    static readReturnType(procKeywordToken: KeywordToken, astCollector: AstCollector, tokenReader: TokenReader, errorCollector: ErrorCollector) {
        tokenReader.moveNextWhile(match => match instanceof NewlineToken);
        const returnTypeToken = tokenReader.peekNextToken();
        if (returnTypeToken === undefined || !(returnTypeToken instanceof ReturnTypeIndicatorToken)) {
            return undefined;
        }
        tokenReader.getNextToken();

        while (true) {
            const nextToken = tokenReader.getNextToken();

            if (nextToken === undefined) break;

            if ((nextToken instanceof KeywordToken && nextToken.keyword === "return") || nextToken instanceof OpenParenthesisToken) {
                tokenReader.moveBack();
                break;
            }

            const tokenPrecedence = nextToken.getPrecedence();
            if (tokenPrecedence === null) {
                parseSingleTokenAst(nextToken, astCollector, tokenReader, errorCollector);
                continue;
            }

            if (tokenPrecedence > returnTypeToken.getPrecedence()) {
                parseSingleTokenAst(nextToken, astCollector, tokenReader, errorCollector);
            } else {
                tokenReader.moveBack();
                break;
            }
        }
        const right = astCollector.popLastExpression()!;
        if (!(right instanceof KeywordExpression)) {
            errorCollector.addError(
                new CompilerError(ErrorCode.ExpectedIdentifier)
                    .addError(right.position, "Invalid type")
                    .addInfo(returnTypeToken.position, "Types can only be simple references to classes or primitives")
            );
            return;
        }
        return new ReturnTypeIndicatorExpression(right);
    }

    static readTypeDeclaration(
        procKeywordToken: KeywordToken,
        openParenthesisToken: OpenParenthesisToken,
        astCollector: AstCollector,
        tokenReader: TokenReader,
        errorCollector: ErrorCollector
    ) {
        const paramsCollector = new AstCollector;
        parseSingleTokenAst(openParenthesisToken, paramsCollector, tokenReader, errorCollector);
        const parameters = paramsCollector.popLastExpression()! as ParenthesisExpression;
        const returnTypeIndicator = this.readReturnType(procKeywordToken, astCollector, tokenReader, errorCollector);

        if (returnTypeIndicator === undefined) {
            errorCollector.addError(
                new CompilerError(ErrorCode.ExpectedParameters)
                    .addError(parameters.position.end.offset(1), "Expected return type")
                    .addInfo(procKeywordToken.position, "Procedure type declaration requires a return type")
            );
            return;
        }

        return new ProcDeclarationExpression(
            procKeywordToken,
            undefined,
            parameters,
            this.parseParameters(procKeywordToken, parameters.expressions, errorCollector),
            undefined,
            returnTypeIndicator?.type
        );
    }

    static readCodeDefinition(
        procKeywordToken: KeywordToken,
        identifierToken: KeywordToken,
        astCollector: AstCollector,
        tokenReader: TokenReader,
        errorCollector: ErrorCollector
    ) {
        tokenReader.moveNextWhile(match => match instanceof NewlineToken);
        const openParenthesisToken = tokenReader.getNextToken();
        if (openParenthesisToken === undefined || !(openParenthesisToken instanceof OpenParenthesisToken)) {
            errorCollector.addError(
                new CompilerError(ErrorCode.ExpectedParameters)
                    .addError(openParenthesisToken?.position || procKeywordToken.position.end.offset(1), "Expected parameters")
                    .addInfo(procKeywordToken.position, "Parameters for procedure and macro declarations can only have identifiers, as well as type guards and default values")
            );
            return;
        }
        parseSingleTokenAst(openParenthesisToken, astCollector, tokenReader, errorCollector);
        const parameters = astCollector.popLastExpression()! as ParenthesisExpression;
        const returnTypeIndicator = this.readReturnType(procKeywordToken, astCollector, tokenReader, errorCollector);
        const codeBlock = this.readCodeBlock(procKeywordToken, returnTypeIndicator || parameters, astCollector, tokenReader, errorCollector);

        if (codeBlock === undefined) return;

        return new ProcDeclarationExpression(
            procKeywordToken,
            identifierToken,
            parameters,
            this.parseParameters(procKeywordToken, parameters.expressions, errorCollector),
            codeBlock,
            returnTypeIndicator?.type
        );
    }

    static read(procKeywordToken: KeywordToken, astCollector: AstCollector, tokenReader: TokenReader, errorCollector: ErrorCollector) {
        tokenReader.moveNextWhile(match => match instanceof NewlineToken);
        const nextToken = tokenReader.getNextToken();
        if (nextToken instanceof OpenParenthesisToken) {
            const decl = this.readTypeDeclaration(procKeywordToken, nextToken, astCollector, tokenReader, errorCollector);
            if (decl !== undefined) astCollector.appendExpression(decl);
        } else if (nextToken instanceof KeywordToken) {
            const decl = this.readCodeDefinition(procKeywordToken, nextToken, astCollector, tokenReader, errorCollector);
            if (decl !== undefined) astCollector.appendExpression(decl);
        } else {
            errorCollector.addError(
                new CompilerError(ErrorCode.ExpectedIdentifier)
                    .addError(nextToken?.position || procKeywordToken.position.end.offset(1), "Expected identifier")
            );
        }
    }

    identifier: string|undefined;
    constructor(
        procKeyword: KeywordToken,
        identifier: KeywordToken|undefined,
        parametersExpression: ParenthesisExpression,
        public readonly parameters: ParameterDeclarationExpression[],
        public readonly block: Expression|undefined,
        public readonly returnType: KeywordExpression|ProcDeclarationExpression|undefined
    ) {
        super(ExpressionKind.ProcDeclaration, FilePositionRange.contain(procKeyword.position, block?.position || parametersExpression.position));
        this.identifier = identifier?.keyword;
    }

    isTypeDeclaration(): this is { identifier: undefined; block: undefined; returnType: KeywordExpression|ProcDeclarationExpression; } {
        return this.identifier === undefined;
    }

    isCodeDefinition(): this is { identifier: string; block: Expression } {
        return this.identifier !== undefined;
    }
}