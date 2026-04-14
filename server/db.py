import sqlite3
import sys
from datetime import datetime
from mealctl.shared.structure import Food, Nutrient, FoodPortion, Meal

class DBHandler:
    def __init__(self, filename) -> None:
        self.conn = sqlite3.connect(':memory:')
        self.cur = self.conn.cursor()

        self.cur.execute(f"ATTACH '{filename}' AS system")
        self.cur.execute(f"ATTACH 'datasets/user.db' AS user")

        self.cur.execute("PRAGMA journal_mode = WAL")
        self.cur.execute("PRAGMA synchronous = NORMAL")
        self.cur.execute("PRAGMA temp_store = MEMORY")
        self.cur.execute("PRAGMA cache_size = -100000")  # ~100MB cache

        views = ['food', 'food_nutrient', 'food_category', 'measure_unit', 'food_portion', 'branded_food']
        for v in views:
            self.cur.execute(f"CREATE TEMP VIEW {v} AS SELECT * FROM system.{v} UNION ALL SELECT * FROM user.{v}")

    def __enter__(self):
        return self

    def __exit__(self, a, b, c):
        self.conn.commit()
        self.conn.close()

    def _fetchDict(self, query, params, factory):
        self.cur.execute(query, params)
        return {row[0]: factory(*row) for row in self.cur.fetchall()}

    def _fetchList(self, query, params, factory):
        self.cur.execute(query, params)
        return [factory(*row) for row in self.cur.fetchall()]

    def getNutrients(self) -> dict[int, Nutrient]:
        return self._fetchDict(
            "SELECT id, name, unit_name FROM nutrient",
            (),
            Nutrient,
        )

    def getPortionUnits(self) -> dict[int, str]:
        return self._fetchDict(
            "SELECT id, name FROM measure_unit",
            (),
            lambda id, name: name,
        )

    def searchFoods(self, pattern: str) -> dict[int, Food]:
        return self._fetchDict(
            "SELECT fdc_id, description, data_type FROM food WHERE description LIKE ? AND data_type = 'foundation_food'",
            (f'%{pattern}%',),
            Food
        )

    def getFoodPortions(self, food: Food) -> dict[int, FoodPortion]:
        return self._fetchDict(
            "SELECT p.id, p.amount, u.name, p.gram_weight FROM food_portion AS p LEFT JOIN measure_unit AS u ON p.measure_unit_id = u.id WHERE fdc_id = ?",
            (food.fdcId,),
            FoodPortion
        )

    def getFoodNutrients(self, food: Food) -> dict[int, float]:
        return self._fetchDict(
            "SELECT nutrient_id, amount FROM food_nutrient WHERE fdc_id = ?",
            (food.fdcId,),
            lambda id, amount: amount
        )

    def logMeal(self, food: Food, weight: float):
        self.cur.execute('INSERT INTO user.consumed_food (fdc_id, weight) VALUES (?, ?)', (food.fdcId, weight))

    def getMeals(self, start: datetime, end: datetime) -> list[Meal]:
        return self._fetchList(
            """SELECT c.weight, c.timestamp, f.fdc_id, f.description, f.data_type
            FROM user.consumed_food AS c 
            LEFT JOIN food AS f ON f.fdc_id = c.fdc_id
            WHERE ? <= timestamp AND timestamp < ?""",
            (start.isoformat(' '), end.isoformat(' ')),
            lambda w, t, fid, fd, fdt: Meal(w, t, Food(fid, fd, fdt))
        )

    def getConsumedNutrients(self, start: datetime, end: datetime) -> dict[int, float]:
        return self._fetchDict(
            """SELECT n.id, SUM(c.weight * fn.amount / 100)
            FROM user.consumed_food AS c 
            LEFT JOIN food_nutrient AS fn ON c.fdc_id = fn.fdc_id
            LEFT JOIN nutrient AS n ON fn.nutrient_id = n.id
            WHERE ? <= timestamp AND timestamp < ?
            GROUP BY n.id""",
            (start.isoformat(' '), end.isoformat(' ')),
            lambda id, amount: amount 
        )

    def getId(self, table: str, field: str, value: str) -> int | None:
        self.cur.execute("SELECT id FROM ? WHERE ? = '?'", (table, field, value))
        row = self.cur.fetchone()
        if row is None: return None
        return row[-1]

    def getUnitId(self, name: str) -> int:
        id = self.getId('measure_unit', 'name', name)
        if id is not None: return id

        self.cur.execute("INSERT INTO user.measure_unit (name) VALUES ('?')", (name,))
        id = self.getId('measure_unit', 'name', name)
        assert id is not None
        return id

    def createUserMeal(self, name: str, nutrients: dict[int, float], portions: list[FoodPortion]):
        if self.getId('food', 'description', name) is not None: raise ValueError(f'Food {name} already exists')
        self.cur.execute("INSERT INTO user.food (data_type, description) VALUES ('foundation_food', '?'", (name,))
        fdc_id = self.getId('food', 'description', name)

        for nutrient, amount in nutrients.items():
            self.cur.execute("INSERT INTO user.food_nutrient (fdc_id, nutrient_id, amount) VALUES (?, ?, ?)", (fdc_id, nutrient, amount))

        for portion in portions:
            unitId = self.getUnitId(portion.unit)
            self.cur.execute("INSERT INTO user.food_portion (fdc_id, amount, measure_unit_id, gram_weight) VALUES (?, ?, ?, ?)", (fdc_id, portion.amount, unitId, portion.weight))

if __name__ == '__main__':
    import sys
    with DBHandler(sys.argv[1]) as dbh:
        # dbh.cur.execute('CREATE INDEX index__food_nutrient__fcd_id ON food_nutrient (fdc_id);')
        # dbh.cur.execute("""SELECT name, SUM(pgsize) / 1024 AS size_in_kb  
        #     FROM user.dbstat  
        #     GROUP BY name  
        #     ORDER BY SUM(pgsize) DESC;""")
        dbh.cur.execute("SELECT name FROM system.sqlite_master;")
        for line in dbh.cur.fetchall():
            print(*line)


