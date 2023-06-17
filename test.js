class Building {
    constructor(floors, width, height) {
        this.floors = floors;
        this.width = width;
        this.height = height;
    }
}

class House extends Building {
    constructor(floors, width, height, bedrooms, bathrooms) {
        super(floors, width, height);
        this.bedrooms = bedrooms;
        this.bathrooms = bathrooms;
    }
}

const house = new House(2, 5, 5, 3, 1);
console.log(house.width);