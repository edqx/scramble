import { AstCollector } from "./astCollector";
import { IfStatementExpression, KeywordExpression, NumberExpression, OperatorExpression, ParenthesisExpression, StringExpression, WhileStatementExpression } from "./expressions";
import { KeywordToken, NewlineToken, NumberToken, OpenParenthesisToken, OperatorToken, StatementBreakToken, StringToken, Token, TokenKind } from "./token";
import { TokenReader } from "./tokenReader";

export function parseSingleTokenAst(token: Token, astCollector: AstCollector, tokenReader: TokenReader) {
    if (token instanceof OperatorToken) {
        OperatorExpression.read(token, astCollector, tokenReader);
    } else if (token instanceof OpenParenthesisToken) {
        ParenthesisExpression.read(token, astCollector, tokenReader);
    } else if (token instanceof KeywordToken) { // only expect statement keywords here as they have precedence
        switch (token.keyword) {
            case "if": IfStatementExpression.read(token, astCollector, tokenReader); break;
            case "while": WhileStatementExpression.read(token, astCollector, tokenReader); break;
        }
        void token;
    } else if (token instanceof StatementBreakToken) {
        void token;
    } else {
        throw new Error(`Unknown token ${TokenKind[token.kind]}`);
    }
}

export function parseAtomicTokenAst(token: Token, astCollector: AstCollector, tokenReader: TokenReader) {
    if (token instanceof NumberToken) {
        astCollector.appendExpression(NumberExpression.from(token));
    } else if (token instanceof StringToken) {
        astCollector.appendExpression(StringExpression.from(token));
    } else if (token instanceof OpenParenthesisToken) {
        ParenthesisExpression.read(token, astCollector, tokenReader);
    } else if (token instanceof KeywordToken) { // no statement keywords here as they have no precedence
        astCollector.appendExpression(KeywordExpression.from(token));
    } else if (token instanceof NewlineToken) {
        void token;
    } else {
        throw new Error(`Unknown token ${TokenKind[token.kind]}`);
    }
}

export function parseAst(tokenReader: TokenReader) {
    const astCollector = new AstCollector;
    while (true) {
        const nextToken = tokenReader.getNextToken();
        
        if (nextToken === undefined) break;

        if (nextToken.getPrecedence() === null) {
            parseAtomicTokenAst(nextToken, astCollector, tokenReader);
            continue;
        }

        parseSingleTokenAst(nextToken, astCollector, tokenReader);
    }
    return astCollector;
}