import time
from pydantic import BaseModel, field_validator, TypeAdapter
from datetime import date, datetime, time, timedelta

class TimeOfDay(BaseModel):
    identifier: str
    start: float
    end: float

    def getSpan(self, day: date) -> tuple[datetime, datetime]:
        d = datetime.combine(day, time(0, 0, 0))
        return d + timedelta(hours=self.start), d + timedelta(hours=self.end)

    def isDuring(self, day: date, timestamp: datetime):
        st, et = self.getSpan(day)
        return st <= timestamp < et

class Range(BaseModel):
    min: float
    max: float

class IntakeSize(BaseModel):
    required: Range
    recommended: Range

class DietConfig(BaseModel):
    times: list[TimeOfDay]
    intake: dict[str, dict[int, IntakeSize]]

    @field_validator('intake', mode='before')
    @classmethod
    def rotateIntake(cls, data):
        # print(value)
        # data = json.loads(value)

        result = {}
        for nutrient in data.values():
            id = int(nutrient['fdc_id'])
            for k, v in nutrient.items():
                if k == 'fdc_id': continue
                if k not in result: result[k] = {}
                result[k][id] = IntakeSize.model_validate(v)
        return result

    @classmethod
    def load(cls):
        with open('config/nutrients.json') as fh:
            return DietConfig.model_validate_json(fh.read())

    def getTimeOfDay(self, timestamp: datetime | None = None) -> list[tuple[date, TimeOfDay]]:
        if timestamp is None:
            timestamp = datetime.now()

        results = []
        for part in self.times:
            day = (timestamp - timedelta(hours=part.start)).date()
            if part.isDuring(day, timestamp): results.append((day, part))
        return results

if __name__ == '__main__':
    diet = DietConfig.load()
    for i in range(100):
        t = datetime.now() + timedelta(hours=i/2)
        print(t, diet.getTimeOfDay(t))
        # for d, p in diet.getTimeOfDay(t):
        #     print(d.isoformat(), p)
        # print()
