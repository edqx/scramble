import { AstCollector } from "./astCollector";
import { ErrorCollector } from "./errorCollector";
import { CompilerError, ErrorCode } from "./error";
import { AccessorExpression, IfStatementExpression, KeywordExpression, NumberExpression, OperatorExpression, ParenthesisExpression, ProcDeclarationExpression, ReturnStatementExpression, StringExpression, TypeGuardExpression, WhileStatementExpression } from "./expression";
import { AccessorToken, CloseParenthesisToken, KeywordToken, NewlineToken, NumberToken, OpenParenthesisToken, OperatorToken, SeparatorToken, StatementBreakToken, StringToken, Token, TokenKind } from "./token";
import { TypeIndicatorToken } from "./token/TypeIndicator";
import { TokenReader } from "./tokenReader";

export function parseSingleTokenAst(token: Token, astCollector: AstCollector, tokenReader: TokenReader, errorCollector: ErrorCollector) {
    if (token instanceof NumberToken) {
        NumberExpression.read(token, astCollector, tokenReader, errorCollector);
    } else if (token instanceof StringToken) {
        StringExpression.read(token, astCollector, tokenReader, errorCollector);
    } else if (token instanceof OperatorToken) {
        OperatorExpression.read(token, astCollector, tokenReader, errorCollector);
    } else if (token instanceof OpenParenthesisToken) {
        ParenthesisExpression.read(token, astCollector, tokenReader, errorCollector);
    } else if (token instanceof KeywordToken) { // only expect statement keywords here as they have precedence
        switch (token.keyword) {
            case "if": IfStatementExpression.read(token, astCollector, tokenReader, errorCollector); break;
            case "while": WhileStatementExpression.read(token, astCollector, tokenReader, errorCollector); break;
            case "proc": ProcDeclarationExpression.read(token, astCollector, tokenReader, errorCollector); break;
            case "return": ReturnStatementExpression.read(token, astCollector, tokenReader, errorCollector); break;
            default: KeywordExpression.read(token, astCollector, tokenReader, errorCollector);
        }
    } else if (token instanceof AccessorToken) {
        AccessorExpression.read(token, astCollector, tokenReader, errorCollector);
    } else if (token instanceof StatementBreakToken || token instanceof NewlineToken || token instanceof SeparatorToken) {
        void token;
    } else if (token instanceof TypeIndicatorToken) {
        TypeGuardExpression.read(token, astCollector, tokenReader, errorCollector);
    } else if (token instanceof CloseParenthesisToken) {
        errorCollector.addError(
            new CompilerError(ErrorCode.MismatchedParenthesis)
                .addError(token.position, "No matching open parenthesis")
        );
    } else {
        throw new Error(`Unknown token ${TokenKind[token.kind]}`);
    }
}

export function parseAst(tokenReader: TokenReader, errorCollector: ErrorCollector) {
    const astCollector = new AstCollector;
    while (true) {
        const nextToken = tokenReader.getNextToken();
        if (nextToken === undefined) break;

        parseSingleTokenAst(nextToken, astCollector, tokenReader, errorCollector);
    }
    return astCollector;
}