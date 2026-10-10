from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime

class Nutrient(BaseModel):
    id: int
    name: str
    unit: str

    def __init__(self, id: int, name: str, unit: str):
        super().__init__(id=id, name=name, unit=unit.lower())

class MeasureUnit(BaseModel):
    id: int
    name: str

class FoodPortionInput(BaseModel):
    amount: float
    unit: str
    weight: float
    modifier: Optional[str] = None
    sequenceNumber: Optional[int] = 0

class FoodPortion(FoodPortionInput):
    id: int

    def __init__(self, id: int, amount: float, unit: str, weight: float, **kwargs):
        BaseModel.__init__(self, id=id, unit=unit, amount=amount, weight=weight, **kwargs)

class Food(BaseModel):
    fdcId: int
    description: str
    dataType: str

    def __init__(self, fdcId: int, description: str, dataType: str, **kwargs):
        super().__init__(fdcId=fdcId, description=description, dataType=dataType, **kwargs)

class Meal(BaseModel):
    id: int
    weight: float
    timestamp: datetime
    food: Food

    def __init__(self, id: int, weight: float, timestamp: datetime, food: Food, **kwargs):
        super().__init__(id=id, weight=weight, timestamp=timestamp, food=food, **kwargs)

class StoredFoodInput(BaseModel):
    fdc_id: int
    amount: float
    acquisition_date: datetime
    expiration_date: datetime

class StoredFoodUpdate(BaseModel):
    id: int
    fdc_id: Optional[int] = None
    amount: Optional[float] = None
    acquisition_date: Optional[datetime] = None
    expiration_date: Optional[datetime] = None

class StoredFood(BaseModel):
    id: int
    fdc_id: int
    amount: float
    acquisition_date: datetime
    expiration_date: datetime

    def __init__(self, id: int, fdc_id: int, amount: float, acquisition_date: datetime, expiration_date: datetime) -> None:
        super().__init__(id=id, fdc_id=fdc_id, amount=amount, acquisition_date=acquisition_date, expiration_date=expiration_date)
