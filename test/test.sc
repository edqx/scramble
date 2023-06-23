proc ret(a: number) {
    
}

proc partial_function(fn: proc(a: number, b: number) -> number) {
    proc ret(a: number) {
        proc ret2(b: number) {
            return fn(a, b);
        }

        return ret2;
    }

    return ret;
}

proc add(a: number, b: number) -> number {
    return a + b;
}

let partial_fn = partial_function(add);

let result = partial_fn(3)(5);

