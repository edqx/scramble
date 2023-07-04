type Listener = proc() -> void;

class EventEmitter {
    listeners: Listener[10];
    num: number;

    proc listen(cb: Listener) {
        this.listeners[this.num] = cb;
        this.num = this.num + 1;
    }

    proc emit() {
        var i = 0;
        while (i < 10) {
            this.listeners[i]();
            i = i + 1;
        }
    }
}

proc noop() {}

proc createEmitter() {
    return EventEmitter{
        Listener[10]{ noop, noop, noop, noop, noop, noop, noop, noop, noop, noop },
        0
    };
}

proc onEvent() {
    var res = 4;
}

proc main() {
    var emitter = createEmitter();

    emitter.listen(onEvent);
    emitter.emit();
}