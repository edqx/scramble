import { parseSingleTokenAst } from "../ast";
import { AstCollector } from "../astCollector";
import { FilePositionRange } from "../stringReader";
import { KeywordToken, NewlineToken, OpenParenthesisToken, StatementBreakToken } from "../token";
import { TokenReader } from "../tokenReader";
import { Expression, ExpressionKind } from "./Expression";

export class IfStatementExpression extends Expression {
    protected static attemptReadElse(conditionAst: AstCollector, blockAst: AstCollector, astCollector: AstCollector, tokenReader: TokenReader) {
        tokenReader.moveNextWhile(token => token instanceof NewlineToken);
        const nextToken = tokenReader.peekNextToken();
        if (nextToken instanceof KeywordToken && nextToken.keyword === "else") {
            tokenReader.getNextToken();
            const elseBlockAst = this.readSingleStatement(tokenReader, false);
            astCollector.appendExpression(new IfStatementExpression(conditionAst.getPrimeExpression()!, blockAst.getPrimeExpression()!, elseBlockAst.getPrimeExpression()));
        } else {
            astCollector.appendExpression(new IfStatementExpression(conditionAst.getPrimeExpression()!, blockAst.getPrimeExpression()!, undefined));
        }
    }

    protected static readSingleStatement(tokenReader: TokenReader, allowElse: boolean) {
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

            if (nextToken.getPrecedence() === null) {
                parseSingleTokenAst(nextToken, blockAst, tokenReader);
                continue;
            }

            parseSingleTokenAst(nextToken, blockAst, tokenReader);
        }
    }

    protected static readThen(conditionAst: AstCollector, astCollector: AstCollector, tokenReader: TokenReader) {
        tokenReader.moveNextWhile(token => token instanceof NewlineToken);
        const blockAst = this.readSingleStatement(tokenReader, true);
        this.attemptReadElse(conditionAst, blockAst, astCollector, tokenReader);
    }

    protected static readBlock(blockToken: OpenParenthesisToken, conditionAst: AstCollector, astCollector: AstCollector, tokenReader: TokenReader) {
        const blockAst = new AstCollector;
        parseSingleTokenAst(blockToken, blockAst, tokenReader);
        this.attemptReadElse(conditionAst, blockAst, astCollector, tokenReader);
    }

    static read(ifKeywordToken: KeywordToken, astCollector: AstCollector, tokenReader: TokenReader) {
        const conditionAst = new AstCollector;
        while (true) {
            const nextToken = tokenReader.getNextToken();
            
            if (nextToken === undefined) throw new Error("Unexpected EOF");

            if (nextToken instanceof KeywordToken && nextToken.keyword === "then") {
                this.readThen(conditionAst, astCollector, tokenReader);
                break;
            }

            if (nextToken instanceof OpenParenthesisToken && nextToken.parenthesis === "{") {
                this.readBlock(nextToken, conditionAst, astCollector, tokenReader);
                break;
            }

            if (nextToken.getPrecedence() === null) {
                parseSingleTokenAst(nextToken, conditionAst, tokenReader);
                continue;
            }

            parseSingleTokenAst(nextToken, conditionAst, tokenReader);
        }
    }

    constructor(public readonly condition: Expression, public readonly block: Expression, public readonly elseBlock: Expression|undefined) {
        super(ExpressionKind.IfStatement, FilePositionRange.contain(condition.position, block.position));
    }
}