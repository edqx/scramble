import { parseAst, parseSingleTokenAst } from "../ast";
import { AstCollector } from "../astCollector";
import { ErrorCollector } from "../errorCollector";
import { CompilerError, ErrorCode } from "../error";
import { FilePositionRange } from "../stringReader";
import { KeywordToken, NewlineToken, OpenParenthesisToken, StatementBreakToken, Token } from "../token";
import { TokenReader } from "../tokenReader";
import { AccessorExpression } from "./Accessor";
import { AssignmentExpression } from "./Assignment";
import { Expression, ExpressionKind } from "./Expression";
import { KeywordExpression } from "./Keyword";
import { ParameterDeclarationExpression } from "./ParameterDeclaration";
import { ParenthesisExpression } from "./Parenthesis";
import { ReturnStatementExpression } from "./ReturnStatement";
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
        if (identifierToken === undefined || !(identifierToken instanceof KeywordToken)) {
            errorCollector.addError(
                new CompilerError(ErrorCode.ExpectedIdentifier)
                    .addError(identifierToken?.position || procKeywordToken.position.end.offset(1), "Expected procedure name identifier")
            );
            return;
        };
        
        tokenReader.moveNextWhile(token => token instanceof NewlineToken);
        const paramsStartToken = tokenReader.getNextToken();
        if (identifierToken === undefined || !(paramsStartToken instanceof OpenParenthesisToken)) {
            errorCollector.addError(
                new CompilerError(ErrorCode.ExpectedIdentifier)
                    .addError(paramsStartToken?.position || identifierToken.position.end.offset(1), "Expected procedure parameter list declaration")
            );
            return;
        }

        const parametersAst = new AstCollector;
        ParenthesisExpression.read(paramsStartToken, parametersAst, tokenReader, errorCollector);

        const parametersList = parametersAst.getPrimeExpression();
        if (!parametersList || !(parametersList instanceof ParenthesisExpression)) {errorCollector.addError(
                new CompilerError(ErrorCode.ExpectedIdentifier)
                    .addError(parametersList?.position || identifierToken.position.end.offset(1), "Expected procedure parameter list declaration")
            );
            return;
        };

        tokenReader.moveNextWhile(token => token instanceof NewlineToken);
        const blockToken = tokenReader.getNextToken();
        if (blockToken === undefined) {
            errorCollector.addError(
                new CompilerError(ErrorCode.MissingCodeBlock)
                    .addError(parametersList.position.end.offset(1), "Expected code block or 'return' statement")
                    .addInfo(parametersList.position, "After defining a procedure's parameters, you need to define the parameter body")
            );
            return;
        }
        parseSingleTokenAst(blockToken, astCollector, tokenReader, errorCollector);
        const expr = astCollector.popLastExpression();
        if (expr instanceof ReturnStatementExpression || expr instanceof ParenthesisExpression) {
            if (expr instanceof ReturnStatementExpression && expr.expression === undefined) {
                errorCollector.addError(
                    new CompilerError(ErrorCode.MissingCodeBlock)
                        .addError(expr.position.end.offset(1), "Expected return value")
                        .addInfo(expr.position, "When using the short-form 'return' statement, you need to return a value")
                );
                return;
            }
            astCollector.appendExpression(
                new ProcDeclarationExpression(
                    procKeywordToken,
                    identifierToken,
                    this.parseParameters(procKeywordToken, parametersList.expressions, errorCollector),
                    expr
                )
            );
        } else {
            errorCollector.addError(
                new CompilerError(ErrorCode.MissingCodeBlock)
                    .addError(expr?.position || parametersList.position.end.offset(1), "Expected code block or 'return' statement")
                    .addInfo(parametersList.position, "After defining a procedure's parameters, you need to define the procedure body")
            );
        }
    }

    identifier: string;
    constructor(
        procKeyword: KeywordToken,
        identifier: KeywordToken,
        public readonly parameters: ParameterDeclarationExpression[],
        public readonly block: Expression
    ) {
        super(ExpressionKind.ProcDeclaration, FilePositionRange.contain(procKeyword.position, block.position));
        this.identifier = identifier.keyword;
    }
}