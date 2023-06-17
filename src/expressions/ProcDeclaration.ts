import { parseAst, parseSingleTokenAst } from "../ast";
import { AstCollector } from "../astCollector";
import { FilePositionRange } from "../stringReader";
import { KeywordToken, NewlineToken, OpenParenthesisToken, StatementBreakToken } from "../token";
import { TokenReader } from "../tokenReader";
import { Expression, ExpressionKind } from "./Expression";
import { ParenthesisExpression } from "./Parenthesis";

export class ProcDeclarationExpression extends Expression {
    protected static readReturnStatement(tokenReader: TokenReader) {
        const blockAst = new AstCollector;
        while (true) {
            const nextToken = tokenReader.getNextToken();
            
            if (nextToken === undefined) return blockAst;

            if (nextToken instanceof NewlineToken || nextToken instanceof StatementBreakToken)
                return blockAst;
            
            parseSingleTokenAst(nextToken, blockAst, tokenReader);
        }
    }

    static read(procKeywordToken: KeywordToken, astCollector: AstCollector, tokenReader: TokenReader) {
        const identifierToken = tokenReader.getNextToken();
        if (identifierToken === undefined) throw new Error("Unexpected EOF");
        if (!(identifierToken instanceof KeywordToken)) throw new Error("Invalid proc identifier");
        
        tokenReader.moveNextWhile(token => token instanceof NewlineToken);
        const paramsStartToken = tokenReader.getNextToken();
        if (identifierToken === undefined) throw new Error("Unexpected EOF");
        if (!(paramsStartToken instanceof OpenParenthesisToken)) throw new Error("Expected proc parameter list");

        const parametersAst = new AstCollector;
        ParenthesisExpression.read(paramsStartToken, parametersAst, tokenReader);

        const parametersList = parametersAst.getPrimeExpression()!;
        if (!(parametersList instanceof ParenthesisExpression)) throw new Error("Expected proc parameter list");

        tokenReader.moveNextWhile(token => token instanceof NewlineToken);
        const block = tokenReader.getNextToken();
        if (block instanceof KeywordToken) {
            if (block.keyword === "return") {
                const blockAst = new AstCollector;
                parseSingleTokenAst(block, blockAst, tokenReader);
                astCollector.appendExpression(new ProcDeclarationExpression(identifierToken, parametersList.expressions, blockAst.getPrimeExpression()!));
                return;
            }
            throw new Error("Expected code block or 'return' statement");
        } else if (block instanceof OpenParenthesisToken && block.parenthesis === "{") {
            const blockAst = new AstCollector;
            parseSingleTokenAst(block, blockAst, tokenReader);
            astCollector.appendExpression(new ProcDeclarationExpression(identifierToken, parametersList.expressions, blockAst.getPrimeExpression()!));
        }
    }

    identifier: string;
    constructor(identifier: KeywordToken, public readonly parameters: Expression[], public readonly block: Expression) {
        super(ExpressionKind.ProcDeclaration, FilePositionRange.contain(identifier.position, block.position));
        this.identifier = identifier.keyword;
    }
}