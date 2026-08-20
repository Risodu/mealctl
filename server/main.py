from datetime import datetime
from flask import Flask, Response, request
from mealctl.server.db import DBHandler
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
    if timestamp is None:
        return 'Missing fields', 400

    try:
        dt = datetime.fromisoformat(timestamp)
    except ValueError:
        return 'Malformed timestamp', 400

    with DBHandler(DATA) as dbh:
        return Response(to_json(getSummary(dbh, dt)), 200, mimetype='application/json')

# def addBrandedFood():

@app.route('/addBrandedFood', methods=['POST'])
@app.route('/addRecipeFood')
@app.route('/editBrandedFood')
@app.route('/editRecipeFood')
def nullfn():
    return 'Not implemented', 501

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

if __name__ == '__main__':
    try:
        app.run(host='0.0.0.0', port=8000, debug=True)
    finally:
        pass
