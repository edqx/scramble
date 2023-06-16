import { StringReader } from "./stringReader";
import { CloseParenthesis, KeywordToken, NumberToken, OpenParenthesisToken, OperatorToken, StringToken, Token } from "./token";

function readSingleToken(stringReader: StringReader) {
    const context = stringReader.createContext();

    const keyword = KeywordToken.read(context);
    if (keyword !== null) return keyword;

    const number = NumberToken.read(context);
    if (number !== null) return number;
    
    const string = StringToken.read(context);
    if (string !== null) return string;

    const operator = OperatorToken.read(context);
    if (operator !== null) return operator;

    const openParenthesis = OpenParenthesisToken.read(context);
    if (openParenthesis !== null) return openParenthesis;

    const closeParenthesis = CloseParenthesis.read(context);
    if (closeParenthesis !== null) return closeParenthesis;

    context.readNextChar();
    context.readWhileRegexMatch(/\s/);
    return null;
}

export function readFileTokens(file: string) {
    const stringReader = new StringReader(file);
    const tokens: Token[] = [];
    while (stringReader.getCharsLeft() > 0) {
        const token = readSingleToken(stringReader);
        if (token === null)
            continue;

        tokens.push(token);
    }
    return tokens;
}