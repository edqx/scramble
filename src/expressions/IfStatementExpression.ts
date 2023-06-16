import { parseAtomicTokenAst, parseSingleTokenAst } from "../ast";
import { AstCollector } from "../astCollector";
import { FilePositionRange } from "../stringReader";
import { KeywordToken, NewlineToken, OpenParenthesisToken, StatementBreakToken } from "../token";
import { TokenReader } from "../tokenReader";
import { Expression, ExpressionKind } from "./Expression";

export class IfStatementExpression extends Expression {
    static read(ifKeywordToken: KeywordToken, astCollector: AstCollector, tokenReader: TokenReader) {
        const conditionAst = new AstCollector;
        while (true) {
            const nextToken = tokenReader.getNextToken();
            
            if (nextToken === undefined) throw new Error("Unexpected EOF");

            if (nextToken instanceof KeywordToken && nextToken.keyword === "then") {
                tokenReader.moveNextWhile(token => token instanceof NewlineToken);
                const blockAst = new AstCollector;
                while (true) {
                    const nextToken = tokenReader.getNextToken();
                    
                    if (nextToken === undefined) throw new Error("Unexpected EOF");

                    if (nextToken instanceof NewlineToken || nextToken instanceof StatementBreakToken) {
                        astCollector.appendExpression(new IfStatementExpression(conditionAst.getPrimeExpression()!, blockAst.getPrimeExpression()!));
                        break;
                    }
        
                    if (nextToken.getPrecedence() === null) {
                        parseAtomicTokenAst(nextToken, blockAst, tokenReader);
                        continue;
                    }
        
                    parseSingleTokenAst(nextToken, blockAst, tokenReader);
                }
                break;
            }

            if (nextToken instanceof OpenParenthesisToken && nextToken.parenthesis === "{") {
                const blockAst = new AstCollector;
                parseSingleTokenAst(nextToken, blockAst, tokenReader);

                astCollector.appendExpression(new IfStatementExpression(conditionAst.getPrimeExpression()!, blockAst.getPrimeExpression()!));
                break;
            }

            if (nextToken.getPrecedence() === null) {
                parseAtomicTokenAst(nextToken, conditionAst, tokenReader);
                continue;
            }

            parseSingleTokenAst(nextToken, conditionAst, tokenReader);
        }
    }

    constructor(public readonly condition: Expression, public readonly block: Expression) {
        super(ExpressionKind.IfStatement, FilePositionRange.contain(condition.position, block.position));
    }
}