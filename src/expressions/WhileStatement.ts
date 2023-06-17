import { parseSingleTokenAst } from "../ast";
import { AstCollector } from "../astCollector";
import { ErrorCollector } from "../errorCollector";
import { CompilerError, ErrorCode } from "../errors";
import { FilePositionRange } from "../stringReader";
import { KeywordToken, NewlineToken, OpenParenthesisToken, StatementBreakToken } from "../token";
import { TokenReader } from "../tokenReader";
import { Expression, ExpressionKind } from "./Expression";

export class WhileStatementExpression extends Expression {
    static read(whileKeywordToken: KeywordToken, astCollector: AstCollector, tokenReader: TokenReader, errorCollector: ErrorCollector) {
        const conditionAst = new AstCollector;
        while (true) {
            const nextToken = tokenReader.getNextToken();
            
            if (nextToken === undefined) {
                const primeExpression = conditionAst.getPrimeExpression()!;
                if (primeExpression === undefined) {
                    errorCollector.addError(
                        new CompilerError(ErrorCode.MissingCondition)
                            .addError(whileKeywordToken.position.end.offset(1), "Expected condition")
                            .addInfo(whileKeywordToken.position, "'while' statement expects a condition following immediately after")
                    );
                } else {
                    errorCollector.addError(
                        new CompilerError(ErrorCode.MissingCodeBlock)
                            .addError(primeExpression.position.end.offset(1), "Expected code block or 'do' statement")
                            .addInfo(whileKeywordToken.position, "'while' statement expects a condition and then a code block following immediately after")
                    );
                }
                break;
            }

            if (nextToken instanceof KeywordToken && nextToken.keyword === "do") {
                tokenReader.moveNextWhile(token => token instanceof NewlineToken);
                const blockAst = new AstCollector;
                while (true) {
                    const nextToken2 = tokenReader.getNextToken();

                    if (nextToken2 === undefined) {
                        errorCollector.addError(
                            new CompilerError(ErrorCode.MissingCodeBlock)
                                .addError(nextToken.position.end.offset(1), "Expected code block")
                                .addInfo(whileKeywordToken.position, "'while' statement expects a code block after 'do'")
                        );
                        break;
                    }

                    if (nextToken2 instanceof NewlineToken || nextToken2 instanceof StatementBreakToken) {
                        astCollector.appendExpression(new WhileStatementExpression(conditionAst.getPrimeExpression()!, blockAst.getPrimeExpression()!));
                        break;
                    }
        
                    parseSingleTokenAst(nextToken2, blockAst, tokenReader, errorCollector);
                }
                break;
            }

            if (nextToken instanceof OpenParenthesisToken && nextToken.parenthesis === "{") {
                const blockAst = new AstCollector;
                parseSingleTokenAst(nextToken, blockAst, tokenReader, errorCollector);

                astCollector.appendExpression(new WhileStatementExpression(conditionAst.getPrimeExpression()!, blockAst.getPrimeExpression()!));
                break;
            }

            parseSingleTokenAst(nextToken, conditionAst, tokenReader, errorCollector);
        }
    }

    constructor(public readonly condition: Expression, public readonly block: Expression) {
        super(ExpressionKind.WhileStatement, FilePositionRange.contain(condition.position, block.position));
    }
}