import { parseSingleTokenAst } from "../parseAst";
import { AstCollector } from "../astCollector";
import { ErrorCollector } from "../errorCollector";
import { CompilerError, ErrorCode } from "../error";
import { FilePositionRange } from "../stringReader";
import { KeywordToken, NewlineToken, OpenParenthesisToken, StatementBreakToken } from "../token";
import { TokenReader } from "../tokenReader";
import { Expression, ExpressionKind } from "./Expression";
import { ParenthesisExpression } from "./Parenthesis";

export class IfStatementExpression extends Expression {
    protected static attemptReadElse(
        ifKeyword: KeywordToken,
        conditionAst: AstCollector,
        blockAst: AstCollector,
        astCollector: AstCollector,
        tokenReader: TokenReader,
        errorCollector: ErrorCollector
    ) {
        tokenReader.moveNextWhile(token => token instanceof NewlineToken);
        const nextToken = tokenReader.peekNextToken();
        if (nextToken instanceof KeywordToken && nextToken.keyword === "else") {
            tokenReader.getNextToken();
            tokenReader.moveNextWhile(token => token instanceof NewlineToken);
            const elseBlockAst = this.readSingleStatement(tokenReader, false, errorCollector);
            const primeExpression = elseBlockAst.getPrimeExpression();
            if (primeExpression === undefined) {
                errorCollector.addError(
                    new CompilerError(ErrorCode.ExpectedCodeBlock)
                        .addError(nextToken.position.end.offset(1), "Expected code block")
                        .addInfo(nextToken.position, "'else' statement expects a code block following immediately after")
                );
            } else {
                astCollector.appendExpression(new IfStatementExpression(ifKeyword, conditionAst.getPrimeExpression()!, blockAst.getPrimeExpression()!, elseBlockAst.getPrimeExpression()));
                return;
            }
        }
        astCollector.appendExpression(new IfStatementExpression(ifKeyword, conditionAst.getPrimeExpression()!, blockAst.getPrimeExpression()!, undefined));
    }

    protected static readSingleStatement(tokenReader: TokenReader, allowElse: boolean, errorCollector: ErrorCollector) {
        const blockAst = new AstCollector;
        while (true) {
            const nextToken = tokenReader.getNextToken();
            
            if (nextToken === undefined) return blockAst;

            if (allowElse && nextToken instanceof KeywordToken && nextToken.keyword === "else") {
                tokenReader.moveBack();
                return blockAst;
            }

            if (nextToken instanceof NewlineToken || nextToken instanceof StatementBreakToken) {
                return blockAst;
            }

            parseSingleTokenAst(nextToken, blockAst, tokenReader, errorCollector);
        }
    }

    protected static readThen(
        ifKeyword: KeywordToken,
        thenKeyword: KeywordToken,
        conditionAst: AstCollector,
        astCollector: AstCollector,
        tokenReader: TokenReader,
        errorCollector: ErrorCollector
    ) {
        tokenReader.moveNextWhile(token => token instanceof NewlineToken);
        const blockAst = this.readSingleStatement(tokenReader, true, errorCollector);
        if (blockAst.getPrimeExpression() === undefined) {
            errorCollector.addError(
                new CompilerError(ErrorCode.ExpectedCodeBlock)
                    .addError(thenKeyword.position.end.offset(1), "Expected code block")
                    .addInfo(thenKeyword.position, "'if' statement expects a code block after 'then'")
            );
            return;
        }
        this.attemptReadElse(ifKeyword, conditionAst, blockAst, astCollector, tokenReader, errorCollector);
    }

    protected static readBlock(
        ifKeyword: KeywordToken,
        blockToken: OpenParenthesisToken,
        conditionAst: AstCollector,
        astCollector: AstCollector,
        tokenReader: TokenReader,
        errorCollector: ErrorCollector
    ) {
        const blockAst = new AstCollector;
        ParenthesisExpression.readExpectBlock(blockToken, blockAst, tokenReader, errorCollector);
        this.attemptReadElse(ifKeyword, conditionAst, blockAst, astCollector, tokenReader, errorCollector);
    }

    static read(ifKeywordToken: KeywordToken, astCollector: AstCollector, tokenReader: TokenReader, errorCollector: ErrorCollector) {
        const conditionAst = new AstCollector;
        while (true) {
            const nextToken = tokenReader.getNextToken();

            if (nextToken === undefined) {
                const primeExpression = conditionAst.getPrimeExpression()!;
                if (primeExpression === undefined) {
                    errorCollector.addError(
                        new CompilerError(ErrorCode.ExpectedCondition)
                            .addError(ifKeywordToken.position.end.offset(1), "Expected condition")
                            .addInfo(ifKeywordToken.position, "'if' statement expects a condition following immediately after")
                    );
                } else {
                    errorCollector.addError(
                        new CompilerError(ErrorCode.ExpectedCodeBlock)
                            .addError(primeExpression.position.end.offset(1), "Expected code block or 'then' statement")
                            .addInfo(ifKeywordToken.position, "'if' statement expects a condition and then a code block following immediately after")
                    );
                }
                break;
            }

            if (nextToken instanceof KeywordToken && nextToken.keyword === "then") {
                this.readThen(ifKeywordToken, nextToken, conditionAst, astCollector, tokenReader, errorCollector);
                break;
            }

            if (nextToken instanceof OpenParenthesisToken && nextToken.parenthesis === "{") {
                this.readBlock(ifKeywordToken, nextToken, conditionAst, astCollector, tokenReader, errorCollector);
                break;
            }

            parseSingleTokenAst(nextToken, conditionAst, tokenReader, errorCollector);
        }
    }

    constructor(
        ifKeyword: KeywordToken,
        public readonly condition: Expression,
        public readonly block: Expression,
        public readonly elseBlock: Expression|undefined
    ) {
        super(ExpressionKind.IfStatement, FilePositionRange.contain(ifKeyword.position, elseBlock?.position || block.position));
    }
}