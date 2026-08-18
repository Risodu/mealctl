function createElement(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function formatAmount(value) {
  const number = Number(value) || 0;
  if (number === 0) return "0";
  if (Math.abs(number) >= 1000) return number.toFixed(0);
  if (Math.abs(number) >= 100) return number.toFixed(1);
  if (Math.abs(number) >= 10) return number.toFixed(1);
  return number.toFixed(2);
}

function formatTime(timestamp) {
  return new Date(timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function renderResultList(container, items, onSelect) {
  container.textContent = "";
  if (!items.length) {
    container.append(createElement("div", "empty-state", "No matching foods."));
    return;
  }

  for (const item of items) {
    const button = createElement("button", "result-item");
    button.type = "button";
    const title = createElement("strong", "", item.description);
    const meta = createElement("small", "", `${item.dataType} · #${item.fdcId}`);
    button.append(title, meta);
    button.addEventListener("click", () => onSelect(item));
    container.append(button);
  }
}

export function renderFoodDetails(container, food, nutrientMap) {
  container.textContent = "";
  if (!food) {
    container.append(createElement("div", "empty-state", "Pick a food to view details."));
    return;
  }

  const header = createElement("div", "food-title");
  header.append(
    createElement("strong", "", food.description),
    createElement("small", "", `${food.dataType} · #${food.fdcId}`),
  );

  const details = createElement("div", "detail-grid");
  details.append(
    infoTile("Portions", String(Object.keys(food.portions || {}).length)),
    infoTile("Nutrients", String(Object.keys(food.nutrients || {}).length)),
    infoTile("Ingredients", food.ingredients ? String(food.ingredients.length) : "None"),
  );

  const portions = createElement("div", "portion-list");
  portions.append(createElement("h3", "", "Portions"));
  const portionValues = Object.values(food.portions || {});
  if (!portionValues.length) {
    portions.append(createElement("div", "empty-state", "No named portions for this food."));
  } else {
    for (const portion of portionValues) {
      portions.append(
        createElement(
          "div",
          "portion-item",
          `${formatAmount(portion.amount)} ${portion.unit || "portion"} = ${formatAmount(portion.weight)} g`,
        ),
      );
    }
  }

  const nutrients = createElement("div", "nutrient-table");
  nutrients.append(createElement("h3", "", "Nutrients per 100 g"));
  const nutrientRows = Object.entries(food.nutrients || {}).sort((a, b) => {
    const left = nutrientMap[a[0]]?.name || a[0];
    const right = nutrientMap[b[0]]?.name || b[0];
    return left.localeCompare(right);
  });
  if (!nutrientRows.length) {
    nutrients.append(createElement("div", "empty-state", "No nutrient data available."));
  } else {
    for (const [id, amount] of nutrientRows) {
      const nutrient = nutrientMap[id] || { name: `#${id}`, unit: "" };
      nutrients.append(createElement("div", "portion-item", `${nutrient.name}: ${formatAmount(amount)} ${nutrient.unit}`));
    }
  }

  container.append(header, details, portions, nutrients);
}

function infoTile(label, value) {
  const tile = createElement("div", "empty-state");
  tile.append(createElement("div", "text-muted", label), createElement("strong", "", value));
  return tile;
}

export function renderSummary(container, summary, nutrientMap, foodCache, onDelete) {
  container.textContent = "";
  if (!summary.length) {
    container.append(createElement("div", "empty-state", "No summary data yet for this day."));
    return;
  }

  for (const part of summary) {
    const card = createElement("article", "card summary-card");
    const title = createElement("div", "food-title");
    title.append(
      createElement("strong", "", titleCase(part.part)),
      createElement("small", "", `${part.meals.length} meal${part.meals.length === 1 ? "" : "s"}`),
    );

    const nutrientList = createElement("div", "nutrient-list");
    for (const nutrient of part.nutrients) {
      nutrientList.append(renderNutrientBar(nutrient, nutrientMap[nutrient.nutrient]));
    }

    const meals = createElement("div", "meal-list");
    meals.append(createElement("h3", "", "Meals"));
    if (!part.meals.length) {
      meals.append(createElement("div", "empty-state", "Nothing logged in this time block."));
    } else {
      for (const meal of part.meals) {
        const item = createElement("div", "meal-item");
        const description = foodCache[meal.fdc_id]?.description || `Food #${meal.fdc_id}`;
        const body = createElement("div", "stack-md");
        body.append(
          createElement("strong", "", description),
          createElement("div", "meal-meta", `${formatTime(meal.timestamp)} · ${formatAmount(meal.weight)} g · #${meal.meal_id}`),
        );

        const button = createElement("button", "", "Delete");
        button.type = "button";
        button.addEventListener("click", () => onDelete(meal.meal_id));
        item.append(body, button);
        meals.append(item);
      }
    }

    card.append(title, nutrientList, meals);
    container.append(card);
  }
}

function renderNutrientBar(item, nutrient) {
  const name = nutrient?.name || `Nutrient #${item.nutrient}`;
  const unit = nutrient?.unit || "";
  const scale = Math.max(item.required.max, item.recommended.max, item.actual, 1);
  const bar = createElement("div", "nutrient-bar");
  const header = createElement("header");
  header.append(
    createElement("strong", "", name),
    createElement("span", "", `${formatAmount(item.actual)} ${unit}`),
  );

  const track = createElement("div", "nutrient-bar-track");
  const required = createElement("div", "range-required");
  required.style.left = `${(item.required.min / scale) * 100}%`;
  required.style.width = `${((item.required.max - item.required.min) / scale) * 100}%`;

  const recommended = createElement("div", "range-recommended");
  recommended.style.left = `${(item.recommended.min / scale) * 100}%`;
  recommended.style.width = `${((item.recommended.max - item.recommended.min) / scale) * 100}%`;

  const actual = createElement("div", "actual-marker");
  actual.style.left = `${Math.min((item.actual / scale) * 100, 100)}%`;

  const caption = createElement("div", "nutrient-caption");
  caption.append(
    createElement("span", "", `Req ${formatAmount(item.required.min)}-${formatAmount(item.required.max)}`),
    createElement("span", "", `Rec ${formatAmount(item.recommended.min)}-${formatAmount(item.recommended.max)} ${unit}`),
  );

  track.append(required, recommended, actual);
  bar.append(header, track, caption);
  return bar;
}

function titleCase(value) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export function renderIngredientOptions(select, results) {
  select.textContent = "";
  if (!results.length) {
    const option = createElement("option", "", "No matches");
    option.value = "";
    select.append(option);
    return;
  }

  for (const item of results) {
    const option = createElement("option", "", `${item.description} (#${item.fdcId})`);
    option.value = String(item.fdcId);
    select.append(option);
  }
}
