# Features

- [x] Log meal
- [x] Show (daily) summary
- [x] Custom elementary foods
- [ ] Custom compound foods

# Backend

- [x] nutrients
- [x] foods
- [x] food
- [x] logMeal
- [x] deleteMeal
- [x] summary
- [ ] addBrandedFood
- [ ] addRecipeFood
- [ ] editBrandedFood
- [ ] editRecipeFood

# APIs

Successful requests respond with `Content-Type: application/json` and status `200`
while unsuccessful requests respond with status `4xx` and plain text content.

## GET nutrients

### Response
```json
{
    "32": {
        "id": 32,
        "name": "Carbohydrates",
        "unit": "g",
    }
}
```

## GET foods/bread

### Response
```json
{
    "123": {
        "fdcId": 123,
        "description": "Bread, white, ...",
        "dataType": "foundation_food"
    }
}
```

## GET food/123

### Response
```json
{
    "fdcId": 123,
    "description": "Bread, white, ...",
    "portions": {
        "4321": {
            "id": 4321
            "amount": 1,
            "unit": "slice",
            "weight": 30
        }
    },
    "nutrients": {
        "10": 32 // specified unit per 100g
    },
    "dataType": "foundation_food" | "branded_food" | "recipe_food",
    "ingredients": null | [
        {
            "fdc_id": 91,
            "weight": 30
        }
    ],
}
```

## POST logMeal

### Request
```json
{
    "fdc_id": 123,
    "weight": 60, // grams
    "timestamp": "1970-01-01T09:12:34"
}
```

### Response
```json
{}
```

## POST deleteMeal

### Request
```json
{
    "meal_id": 9841
}
```

### Response
```json
{}
```

## GET summary/1970-01-01

### Response
```json
[
    {
        "part": "morning",
        "nutrients": [
            {
                "nutrient": 32, // id
                "required": {
                    "min": 100,
                    "max": 300
                },
                "recommended": {
                    "min": 150,
                    "max": 250
                },
                "actual": 97
            }
        ],
        "meals": [
            {
                "fdc_id": 123,
                "meal_id": 9841,
                "weight": 60, // grams
                "timestamp": "1970-01-01T09:12:34"
            }
        ]
    }
]
```

## POST addBrandedFood

### Request
```json
{
    "name": "Termix, chocolate flavour",
    "nutrients": [
        {
            "id": 10
            "amount": 15
        }
    ],
    "portions": [
        {
            "amount": 1,
            "unit": "package",
            "weight": 40
        }
    ]
}
```

### Response
```json
{}
```

## POST addRecipeFood

### Request
```json
{
    "name": "Salad, homemade",
    "ingredients": [
        {
            "fdc_id": 91,
            "weight": 30
        }
    ],
    "portions": [
        {
            "amount": 1,
            "unit": "bowl",
            "weight": 60
        }
    ]
}
```

### Response
```json
{}
```

## POST editBrandedFood / editRecipeFood

### Request
```json
{
    "fdc_id": 123,
    ... // Same as addBrandedFood / addRecipeFood
}
```

### Response
```json
{}
```
