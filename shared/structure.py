from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime

class Nutrient(BaseModel):
    id: int
    name: str
    unit: str
    number: Optional[str] = ''
    rank: Optional[int] = 0

    def __init__(self, id: int, name: str, unit: str, **kwargs):
        super().__init__(id=id, name=name, unit=unit, **kwargs)

class MeasureUnit(BaseModel):
    id: int
    name: str

class FoodPortion(BaseModel):
    id: int
    amount: float
    unit: str
    weight: float
    modifier: Optional[str] = None
    sequenceNumber: Optional[int] = 0

    def __init__(self, id: int, amount: float, unit: str, weight: float, **kwargs):
        super().__init__(id=id, unit=unit, amount=amount, weight=weight, **kwargs)

class Food(BaseModel):
    fdcId: int
    description: str
    dataType: str

    def __init__(self, fdcId: int, description: str, dataType: str, **kwargs):
        super().__init__(fdcId=fdcId, description=description, dataType=dataType, **kwargs)

class Meal(BaseModel):
    weight: float
    timestamp: datetime
    food: Food

    def __init__(self, weight: float, timestamp: datetime, food: Food, **kwargs):
        super().__init__(weight=weight, timestamp=timestamp, food=food, **kwargs)
