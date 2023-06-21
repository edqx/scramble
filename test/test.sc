proc add(a: number, b: number) {
    return a + b;
}

var addFunction = add;

var result1 = add(2, 3);
var result2 = addFunction(2, 3);

var result3 = addFunction + 4;