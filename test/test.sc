var this = Person{ name="Edward", health=100, age=18, reasonForDeath="" }

class Person {
    name: string;
    health: number;
    age: number;
    reasonForDeath: string;

    proc kill(reason: string) {
        this.health = 0;
        this.reasonForDeath = reason;
    }
}