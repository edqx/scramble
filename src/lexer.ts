import { ErrorCollector } from "./errorCollector";
import { StringReader } from "./stringReader";
import { CloseParenthesisToken, KeywordToken, NewlineToken, NumberToken, OpenParenthesisToken, OperatorToken, StatementBreakToken, StringToken, Token } from "./token";

function readSingleToken(stringReader: StringReader, errorCollector: ErrorCollector) {
    const context = stringReader.createContext();

    const keyword = KeywordToken.read(context, errorCollector);
    if (keyword !== null) return keyword;

    const number = NumberToken.read(context, errorCollector);
    if (number !== null) return number;
    
    const string = StringToken.read(context, errorCollector);
    if (string !== null) return string;

    const operator = OperatorToken.read(context, errorCollector);
    if (operator !== null) return operator;

    const openParenthesis = OpenParenthesisToken.read(context, errorCollector);
    if (openParenthesis !== null) return openParenthesis;

    const closeParenthesis = CloseParenthesisToken.read(context, errorCollector);
    if (closeParenthesis !== null) return closeParenthesis;

    const statementBreak = StatementBreakToken.read(context, errorCollector);
    if (statementBreak !== null) return statementBreak;
    
    const newline = NewlineToken.read(context, errorCollector);
    if (newline !== null) return newline;

    context.readNextChar();
    context.readWhileRegexMatch(/\s/);
    return null;
}

export function readFileTokens(file: string, errorCollector: ErrorCollector) {
    const stringReader = new StringReader(file);
    const tokens: Token[] = [];
    while (stringReader.getCharsLeft() > 0) {
        const token = readSingleToken(stringReader, errorCollector);
        if (token === null)
            continue;

        tokens.push(token);
    }
    return tokens;
}