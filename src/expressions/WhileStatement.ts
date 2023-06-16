import { parseSingleTokenAst } from "../ast";
import { AstCollector } from "../astCollector";
import { FilePositionRange } from "../stringReader";
import { KeywordToken, NewlineToken, OpenParenthesisToken, StatementBreakToken } from "../token";
import { TokenReader } from "../tokenReader";
import { Expression, ExpressionKind } from "./Expression";

export class WhileStatementExpression extends Expression {
    static read(whileKeywordToken: KeywordToken, astCollector: AstCollector, tokenReader: TokenReader) {
        const conditionAst = new AstCollector;
        while (true) {
            const nextToken = tokenReader.getNextToken();
            
            if (nextToken === undefined) throw new Error("Unexpected EOF");

            if (nextToken instanceof KeywordToken && nextToken.keyword === "do") {
                tokenReader.moveNextWhile(token => token instanceof NewlineToken);
                const blockAst = new AstCollector;
                while (true) {
                    const nextToken = tokenReader.getNextToken();
                    
                    if (nextToken === undefined) throw new Error("Unexpected EOF");

                    if (nextToken instanceof NewlineToken || nextToken instanceof StatementBreakToken) {
                        astCollector.appendExpression(new WhileStatementExpression(conditionAst.getPrimeExpression()!, blockAst.getPrimeExpression()!));
                        break;
                    }
        
                    if (nextToken.getPrecedence() === null) {
                        parseSingleTokenAst(nextToken, blockAst, tokenReader);
                        continue;
                    }
        
                    parseSingleTokenAst(nextToken, blockAst, tokenReader);
                }
                break;
            }

            if (nextToken instanceof OpenParenthesisToken && nextToken.parenthesis === "{") {
                const blockAst = new AstCollector;
                parseSingleTokenAst(nextToken, blockAst, tokenReader);

                astCollector.appendExpression(new WhileStatementExpression(conditionAst.getPrimeExpression()!, blockAst.getPrimeExpression()!));
                break;
            }

            if (nextToken.getPrecedence() === null) {
                parseSingleTokenAst(nextToken, conditionAst, tokenReader);
                continue;
            }

            parseSingleTokenAst(nextToken, conditionAst, tokenReader);
        }
    }

    constructor(public readonly condition: Expression, public readonly block: Expression) {
        super(ExpressionKind.WhileStatement, FilePositionRange.contain(condition.position, block.position));
    }
}