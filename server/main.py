from datetime import datetime
from flask import Flask, Response, request
import flask_pydantic
from mealctl.server.db import DBHandler
from mealctl.shared.structure import FoodPortion, FoodPortionInput, StoredFoodInput, StoredFoodUpdate
from pydantic_core import to_json, to_jsonable_python
import pydantic
from flask_pydantic import validate
from werkzeug.exceptions import HTTPException
from mealctl.shared.diet import DietConfig

app = Flask(__name__)

DATA = 'datasets/foundation-food.db'

@app.route('/nutrients')
def getNutrients():
    with DBHandler(DATA) as dbh:
        nutrients = dbh.getNutrients()

    data = to_json(nutrients)
    return Response(data, 200, mimetype='application/json')

@app.route('/foods/<string:pattern>')
def getFoods(pattern: str):
    with DBHandler(DATA) as dbh:
        foods = dbh.searchFoods(pattern)

    data = to_json(foods)
    return Response(data, 200, mimetype='application/json')

@app.route('/food/<int:fdcId>')
def getFoodDetails(fdcId: int):
    with DBHandler(DATA) as dbh:
        food = dbh.getFood(fdcId)
        print(repr(fdcId))
        if food is None:
            return 'Invalid id', 422
            # return Response(to_json({'message': 'Invalid id'}), 404, mimetype='application/json')

        portions = dbh.getFoodPortions(food)
        nutrients = dbh.getFoodNutrients(food)

        data = to_jsonable_python(food)
        data['nutrients'] = nutrients
        data['portions'] = portions
        data['ingredients'] = None

    return Response(to_json(data), 200, mimetype='application/json')

class LogMealRequest(pydantic.BaseModel):
    fdc_id: int
    weight: float
    timestamp: datetime

@app.route('/logMeal', methods=['POST'])
@validate()
def logMeal(body: LogMealRequest):
    with DBHandler(DATA) as dbh:
        food = dbh.getFood(body.fdc_id)
        if food is None:
            return 'Invalid food id', 422

        dbh.logMeal(food, body.weight, body.timestamp)

    return Response('{}', 201, mimetype='application/json')

class DeleteMealRequest(pydantic.BaseModel):
    meal_id: int

@app.route('/deleteMeal', methods=['POST'])
@validate()
def deleteMeal(body: DeleteMealRequest):
    with DBHandler(DATA) as dbh:
        dbh.deleteMeal(body.meal_id) # TODO: verify it meal exists

    return Response('{}', 200, mimetype='application/json')

def getSummary(dbh: DBHandler, timestamp: datetime):
    nutrientData = dbh.getNutrients()
    diet = DietConfig.load()
    weight = 0.065

    timespans = []
    # for day, part in diet.getTimeOfDay(timestamp):
    for part in diet.times:
        st, et = part.getSpan(timestamp.date())
        nutrients = []

        nutrientsGot = dbh.getConsumedNutrients(st, et)
        for nutrientId, intake in diet.intake[part.identifier].items():
            nutrient = nutrientData[nutrientId]
            nutrients.append({
                'nutrient': nutrient.id,
                'required': {
                    'min': weight * intake.required.min,
                    'max': weight * intake.required.max,
                },
                'recommended': {
                    'min': weight * intake.recommended.min,
                    'max': weight * intake.recommended.max,
                },
                'actual': nutrientsGot.get(nutrientId, 0)
            })

        meals = []
        for meal in dbh.getMeals(st, et):
            meals.append({
                'fdc_id': meal.food.fdcId,
                'meal_id': meal.id,
                'weight': meal.weight,
                'timestamp': meal.timestamp.isoformat()
            })

        timespans.append({
            'part': part.identifier,
            'nutrients': nutrients,
            'meals': meals
        })
    return timespans

@app.route('/summary/<string:timestamp>')
def summary(timestamp):
    try:
        dt = datetime.fromisoformat(timestamp)
    except ValueError:
        return 'Malformed timestamp', 400

    with DBHandler(DATA) as dbh:
        return Response(to_json(getSummary(dbh, dt)), 200, mimetype='application/json')

class NutrientContent(pydantic.BaseModel):
    id: int
    amount: float

class BrandedFood(pydantic.BaseModel):
    name: str
    nutrients: list[NutrientContent]
    portions: list[FoodPortionInput]

@app.route('/addBrandedFood', methods=['POST'])
@validate()
def addBrandedFood(body: BrandedFood):
    with DBHandler(DATA) as dbh:
        if dbh.getFdcIdByDescription(body.name) is not None:
            return f'Food {body.name} already exists', 422

        dbh.createUserMeal(body.name, {i.id: i.amount for i in body.nutrients}, body.portions)

    return Response('{}', 200, mimetype='application/json')

@app.route('/addRecipeFood')
@app.route('/editBrandedFood')
@app.route('/editRecipeFood')
def nullfn():
    return 'Not implemented', 501

@app.route('/stored')
def getStored():
    with DBHandler(DATA) as dbh:
        return Response(to_json(dbh.getStored()), 200, mimetype='application/json')

@app.route('/stored', methods=['POST'])
@validate()
def addStored(body: StoredFoodInput):
    with DBHandler(DATA) as dbh:
        dbh.insertStored(body)

    return Response('{}', 200, mimetype='application/json')

@app.route('/stored', methods=['PUT'])
@validate()
def updateStored(body: StoredFoodUpdate):
    with DBHandler(DATA) as dbh:
        if dbh.getStoredById(body.id) is None:
            return "Entry with this id does not exist", 404
        dbh.updateStored(body)

    return Response('{}', 200, mimetype='application/json')

class DeleteStoredRequest(pydantic.BaseModel):
    id: int

@app.route('/stored', methods=['DELETE'])
@validate()
def deleteStored(body: DeleteStoredRequest):
    with DBHandler(DATA) as dbh:
        if dbh.getStoredById(body.id) is None:
            return "Entry with this id does not exist", 404
        dbh.deleteStored(body.id)

    return Response('{}', 200, mimetype='application/json')

@app.errorhandler(HTTPException)
def handle_exception(e):
    """Return JSON instead of HTML for HTTP errors."""
    # start with the correct headers and status code from the error
    # response = e.get_response()
    # replace the body with JSON
    # response.data = json.dumps({
    #     "code": e.code,
    #     "name": e.name,
    #     "description": e.description,
    # })
    # response.content_type = "application/json"
    return e.name, e.code

@app.errorhandler(flask_pydantic.exceptions.JsonBodyParsingError)
def handleJsonBodyParsingError(e):
    return "Malformed request", 400

@app.after_request
def handle_options(response):
    response.headers["Access-Control-Allow-Origin"] = "http://localhost:8001"
    response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, OPTIONS"
    response.headers["Access-Control-Allow-Headers"] = "Content-Type, X-Requested-With"

    return response

if __name__ == '__main__':
    try:
        app.run(host='0.0.0.0', port=8000, debug=True)
    finally:
        pass
