from dataclasses import Field
from sqlite3 import Row
import tabulate
import sys

from mealctl.server.db import DBHandler
from mealctl.shared.structure import Food
from mealctl.shared.diet import DietConfig
import mealctl.cli_client.tui_editor as editor

diet = DietConfig.load()
weight = 0.065

def askInput(prompt, parser, error_msg="Invalid input"):
    while True:
        try:
            return parser(input(prompt))
        except Exception as e:
            print(f"{error_msg}: {e}")

def parseYN(s):
    s = s.lower()
    if s == 'y': return True
    if s == 'n': return False
    raise ValueError('Value must by y/n')

def selectFromList(items, label_fn):
    if len(items) > 30:
        if not askInput(f'Display all {len(items)} possibilities? [y/n]: ', parseYN):
            return None

    if len(items) == 0:
        print('Nothing to pick from')
        return None

    while True:
        for i, item in enumerate(items):
            print(f"{i}: {label_fn(item)}")

        choice = input("Select index: ").strip()

        if choice == "":
            return None

        # if choice.lower() == "q":
        #     return "QUIT"

        try:
            return items[int(choice)]
        except (ValueError, IndexError):
            print("Invalid selection")

def askForMeal(dbh: DBHandler) -> Food:
    selection = None
    while True:
        pattern = input('Enter food: ')
        res = [*dbh.searchFoods(pattern).values()]

        if len(res) == 1:
            selection = res[0]
            break

        if len(res) == 0:
            print('No meals found')
            continue

        selection = selectFromList(res, lambda x: x.description)
        if selection is None:
            continue

        break

    print('Selected:', selection.description)
    return selection

def chooseAmount(dbh: DBHandler, food: Food | None) -> float:
    portions = list(dbh.getFoodPortions(food).values()) if food is not None else []

    if portions:
        print("Available portions:")
        for i, p in enumerate(portions):
            print(f"{i}: {p.amount} {p.unit} = {p.weight} g")

    while True:
        raw = input("Enter amount (grams OR amount index): ").split()

        try:
            if len(raw) == 1:
                return float(raw[0])

            if len(raw) == 2:
                count = float(raw[0])
                portion = portions[int(raw[1])]
                return count * portion.weight

            raise ValueError("Enter 1 or 2 numbers")

        except (ValueError, IndexError) as e:
            print(f"Invalid input: {e}")

def logMealDialog(dbh: DBHandler):
    food = askForMeal(dbh)
    amount = chooseAmount(dbh, food)
    dbh.logMeal(food, amount)

def getSummary(dbh: DBHandler):
    nutrientData = dbh.getNutrients()
    for day, part in diet.getTimeOfDay():
        st, et = part.getSpan(day)
        print(part.identifier, day)
        # print(st, et)
        for meal in dbh.getMeals(st, et):
            print(f'{meal.timestamp.time()}: {meal.food.description}, {meal.weight:.1f} g')

        nutrientsGot = dbh.getConsumedNutrients(st, et)
        for nutrientId, intake in diet.intake[part.identifier].items():
            nutrient = nutrientData[nutrientId]
            print(f'{nutrient.name}: {nutrientsGot.get(nutrientId, 0):.3g} {nutrient.unit}')
            print(weight * intake.required.min, weight * intake.recommended.min, weight * intake.recommended.max, weight * intake.required.max)
            print()
        print()

def createMeal(dbh: DBHandler):
    nutrientData = dbh.getNutrients()
    # nutrientIds = set.union(set(), *(i.keys() for i in diet.intake.values()))
    nutrientIds = [1008, 1004, 1258, 1005, 2000, 1079, 1003, 1149, 1051]
    nutrients = [nutrientData[i] for i in nutrientIds]
    nutrientNames = [nutrientData[i].name for i in nutrientIds]
    fields = ['Name'] + nutrientNames + ['Portions']

    schema = tuple([
        editor.Field('Name'),
    ] + [editor.Field(n.name, n.unit) for n in nutrients] + [
        editor.Field('Portions'),
        editor.Annotation('Portion format: 1 teaspoon=5, 1 tablespoon=15 (in grams)'),
        editor.Annotation('Available portion units:'),
        editor.Annotation(', '.join(dbh.getPortionUnits().values()))
    ])
    result = editor.editDict(schema, {i: '' for i in fields})

    print(result)

def main(dbh: DBHandler):
    c = input('Enter command (Summary, Log, Create):')[0].lower()
    if c == 'l': logMealDialog(dbh)
    if c == 's': getSummary(dbh)
    if c == 'c': createMeal(dbh)
    return
    nutrients = dbh.getNutrients()

    kws = input('Enter food: ').lower()
    headers = ['Description'] + [*fields]
    table = []
    for food in dbh.searchFoods(kws).values():
        # for kw in kws:
        #     if kw in food.description.lower(): break
        # else: continue
        print(food.description)
        for portion in dbh.getFoodPortions(food).values():
            print(portion)
        print()

        row = [food.description]
        foodn = dbh.getFoodNutrients(food)
        for field in fields.values():
            amount = foodn.get(field['id'], '?')
            row.append(str(amount))
        table.append(row)

    print(tabulate.tabulate(table, headers, 'fancy'))

if __name__ == '__main__':
    with DBHandler(sys.argv[1]) as dbh:
        main(dbh)
