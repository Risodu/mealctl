FROM python:3.11-slim

WORKDIR /app/mealctl

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

ENV PYTHONPATH="$PYTHONPATH:/app/"

CMD ["python", "cli_client/main.py", "datasets/foundation-food.db"]
