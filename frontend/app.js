import { createApi } from "./api.js";
import { state, setApiBase, today } from "./state.js";
import { renderFoodDetails, renderIngredientOptions, renderResultList, renderSummary } from "./ui.js";

const api = createApi(() => state.apiBase);
let searchTimer = null;
let browserTimer = null;

const elements = {
  apiBaseInput: document.querySelector("#api-base-input"),
  settingsForm: document.querySelector("#settings-form"),
  globalError: document.querySelector("#global-error"),
  tabs: [...document.querySelectorAll(".tab")],
  views: [...document.querySelectorAll(".view")],
  summaryDate: document.querySelector("#summary-date"),
  summaryControls: document.querySelector("#summary-controls"),
  summaryToday: document.querySelector("#summary-today"),
  summaryStatus: document.querySelector("#summary-status"),
  summaryGrid: document.querySelector("#summary-grid"),
  foodSearchInput: document.querySelector("#food-search-input"),
  foodSearchStatus: document.querySelector("#food-search-status"),
  foodSearchResults: document.querySelector("#food-search-results"),
  selectedFoodPanel: document.querySelector("#selected-food-panel"),
  logMealForm: document.querySelector("#log-meal-form"),
  mealTimestamp: document.querySelector("#meal-timestamp"),
  quantityMode: document.querySelector("#quantity-mode"),
  gramsInput: document.querySelector("#grams-input"),
  portionSelect: document.querySelector("#portion-select"),
  portionCount: document.querySelector("#portion-count"),
  computedWeight: document.querySelector("#computed-weight"),
  logFormError: document.querySelector("#log-form-error"),
  foodsBrowserInput: document.querySelector("#foods-browser-input"),
  foodsBrowserStatus: document.querySelector("#foods-browser-status"),
  foodsBrowserResults: document.querySelector("#foods-browser-results"),
  foodsDetailPanel: document.querySelector("#foods-detail-panel"),
  customFoodForm: document.querySelector("#custom-food-form"),
  customAction: document.querySelector("#custom-action"),
  customFdcWrap: document.querySelector("#custom-fdc-wrap"),
  customFdcId: document.querySelector("#custom-fdc-id"),
  customName: document.querySelector("#custom-name"),
  recipeIngredientsBlock: document.querySelector("#recipe-ingredients-block"),
  nutrientsBlock: document.querySelector("#nutrients-block"),
  nutrientRows: document.querySelector("#nutrient-rows"),
  ingredientsList: document.querySelector("#ingredients-list"),
  portionRows: document.querySelector("#portion-rows"),
  addNutrientRow: document.querySelector("#add-nutrient-row"),
  addIngredientRow: document.querySelector("#add-ingredient-row"),
  addPortionRow: document.querySelector("#add-portion-row"),
  customFormError: document.querySelector("#custom-form-error"),
};

init();

async function init() {
  elements.apiBaseInput.value = state.apiBase;
  elements.summaryDate.value = state.summaryDate;
  elements.mealTimestamp.value = nowLocalValue();

  bindEvents();
  addNutrientRow();
  addPortionRow();
  updateCustomFormMode();
  await loadInitialData();
}

function bindEvents() {
  elements.settingsForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    setApiBase(elements.apiBaseInput.value.trim());
    clearGlobalError();
    await loadInitialData();
  });

  for (const tab of elements.tabs) {
    tab.addEventListener("click", () => setActiveView(tab.dataset.viewTarget));
  }

  elements.summaryControls.addEventListener("submit", async (event) => {
    event.preventDefault();
    state.summaryDate = elements.summaryDate.value || today();
    await loadSummary();
  });

  elements.summaryToday.addEventListener("click", async () => {
    state.summaryDate = today();
    elements.summaryDate.value = state.summaryDate;
    await loadSummary();
  });

  elements.foodSearchInput.addEventListener("input", () => {
    debounceSearch("log");
  });

  elements.foodsBrowserInput.addEventListener("input", () => {
    debounceSearch("browse");
  });

  elements.quantityMode.addEventListener("change", renderComputedWeight);
  elements.gramsInput.addEventListener("input", renderComputedWeight);
  elements.portionSelect.addEventListener("change", renderComputedWeight);
  elements.portionCount.addEventListener("input", renderComputedWeight);

  elements.logMealForm.addEventListener("submit", submitLogMeal);

  elements.customAction.addEventListener("change", updateCustomFormMode);
  elements.addNutrientRow.addEventListener("click", () => addNutrientRow());
  elements.addIngredientRow.addEventListener("click", () => addIngredientRow());
  elements.addPortionRow.addEventListener("click", () => addPortionRow());
  elements.customFoodForm.addEventListener("submit", submitCustomFood);
}

async function loadInitialData() {
  await Promise.all([loadNutrients(), loadSummary()]);
}

async function loadNutrients() {
  try {
    state.nutrients = await api.getNutrients();
    syncNutrientSelects();
    clearGlobalError();
  } catch (error) {
    showGlobalError(error.message);
  }
}

async function loadSummary() {
  state.pending.summary = true;
  elements.summaryStatus.textContent = "Loading summary...";

  try {
    const summary = await api.getSummary(state.summaryDate);
    state.summary = summary;
    await hydrateMealDescriptions(summary);
    elements.summaryStatus.textContent = `Loaded ${summary.length} time blocks for ${state.summaryDate}.`;
    renderSummary(elements.summaryGrid, state.summary, state.nutrients, state.foodCache, deleteMeal);
    clearGlobalError();
  } catch (error) {
    elements.summaryStatus.textContent = "";
    showGlobalError(error.message);
    renderSummary(elements.summaryGrid, [], state.nutrients, state.foodCache, deleteMeal);
  } finally {
    state.pending.summary = false;
  }
}

async function hydrateMealDescriptions(summary) {
  const ids = [...new Set(summary.flatMap((part) => part.meals.map((meal) => meal.fdc_id)))];
  await Promise.all(
    ids
      .filter((id) => !state.foodCache[id])
      .map(async (id) => {
        try {
          state.foodCache[id] = await api.getFood(id);
        } catch {
          state.foodCache[id] = { description: `Food #${id}`, fdcId: id };
        }
      }),
  );
}

function debounceSearch(mode) {
  const input = mode === "log" ? elements.foodSearchInput : elements.foodsBrowserInput;
  const timer = mode === "log" ? searchTimer : browserTimer;
  window.clearTimeout(timer);

  const handle = window.setTimeout(() => {
    void performSearch(mode, input.value.trim());
  }, 250);

  if (mode === "log") searchTimer = handle;
  else browserTimer = handle;
}

async function performSearch(mode, query) {
  const status = mode === "log" ? elements.foodSearchStatus : elements.foodsBrowserStatus;
  const target = mode === "log" ? elements.foodSearchResults : elements.foodsBrowserResults;

  if (query.length < 2) {
    status.textContent = "Type at least 2 letters to search.";
    target.textContent = "";
    return;
  }

  status.textContent = "Searching...";
  try {
    const results = Object.values(await api.searchFoods(query));
    status.textContent = `${results.length} result${results.length === 1 ? "" : "s"}.`;
    renderResultList(target, results, (item) => selectFood(item.fdcId, mode));
    clearGlobalError();

    if (mode === "browse") {
      for (const row of document.querySelectorAll(".ingredient-food-select")) {
        renderIngredientOptions(row, results);
      }
    }
  } catch (error) {
    status.textContent = "";
    target.textContent = "";
    showGlobalError(error.message);
  }
}

async function selectFood(fdcId, source) {
  elements.logFormError.classList.add("hidden");
  try {
    const food = state.foodCache[fdcId] || (await api.getFood(fdcId));
    state.foodCache[fdcId] = food;
    state.selectedFood = food;
    state.selectedFoodSource = source;

    if (source === "log") {
      renderFoodDetails(elements.selectedFoodPanel, food, state.nutrients);
      fillPortions(food);
      elements.logMealForm.classList.remove("hidden");
      renderComputedWeight();
    } else {
      renderFoodDetails(elements.foodsDetailPanel, food, state.nutrients);
    }

    clearGlobalError();
  } catch (error) {
    showGlobalError(error.message);
  }
}

function fillPortions(food) {
  elements.portionSelect.textContent = "";
  const portions = Object.values(food.portions || {});
  if (!portions.length) {
    const option = document.createElement("option");
    option.value = "";
    option.textContent = "No named portions";
    elements.portionSelect.append(option);
    return;
  }

  for (const portion of portions) {
    const option = document.createElement("option");
    option.value = portion.id;
    option.dataset.weight = portion.weight;
    option.textContent = `${portion.amount} ${portion.unit || "portion"} = ${portion.weight} g`;
    elements.portionSelect.append(option);
  }
}

function renderComputedWeight() {
  const { weight, message } = getComputedWeight();
  if (!state.selectedFood) {
    elements.computedWeight.textContent = "";
    return;
  }

  elements.computedWeight.textContent = message || `Computed weight: ${weight.toFixed(1)} g`;
}

function getComputedWeight() {
  if (elements.quantityMode.value === "grams") {
    const grams = Number(elements.gramsInput.value);
    return {
      weight: grams,
      message: Number.isFinite(grams) && grams > 0 ? `Computed weight: ${grams.toFixed(1)} g` : "Enter a positive gram value.",
    };
  }

  const selected = elements.portionSelect.selectedOptions[0];
  const portionWeight = Number(selected?.dataset.weight);
  const count = Number(elements.portionCount.value);
  const weight = portionWeight * count;
  return {
    weight,
    message: Number.isFinite(weight) && weight > 0 ? `Computed weight: ${weight.toFixed(1)} g` : "Pick a portion and count.",
  };
}

async function submitLogMeal(event) {
  event.preventDefault();
  if (!state.selectedFood) return;

  const { weight } = getComputedWeight();
  if (!Number.isFinite(weight) || weight <= 0) {
    showInlineError(elements.logFormError, "Weight must be a positive number.");
    return;
  }

  const timestamp = elements.mealTimestamp.value;
  if (!timestamp) {
    showInlineError(elements.logFormError, "Timestamp is required.");
    return;
  }

  try {
    await api.logMeal({
      fdc_id: state.selectedFood.fdcId,
      weight,
      timestamp,
    });
    hideInlineError(elements.logFormError);
    elements.mealTimestamp.value = nowLocalValue();
    await loadSummary();
    setActiveView("dashboard-view");
  } catch (error) {
    showInlineError(elements.logFormError, error.message);
  }
}

async function deleteMeal(mealId) {
  try {
    await api.deleteMeal(mealId);
    await loadSummary();
  } catch (error) {
    showGlobalError(error.message);
  }
}

function updateCustomFormMode() {
  const action = elements.customAction.value;
  const isRecipe = action === "addRecipeFood" || action === "editRecipeFood";
  const isEdit = action === "editBrandedFood" || action === "editRecipeFood";

  elements.recipeIngredientsBlock.classList.toggle("hidden", !isRecipe);
  elements.nutrientsBlock.classList.toggle("hidden", isRecipe);
  elements.customFdcWrap.classList.toggle("hidden", !isEdit);

  if (isRecipe && !elements.ingredientsList.children.length) addIngredientRow();
  if (!isRecipe && !elements.nutrientRows.children.length) addNutrientRow();
}

function addNutrientRow() {
  const row = document.createElement("div");
  row.className = "dynamic-row";

  const selectLabel = document.createElement("label");
  selectLabel.append(document.createElement("span"));
  selectLabel.firstChild.textContent = "Nutrient";
  const select = document.createElement("select");
  select.className = "nutrient-id-select";
  selectLabel.append(select);

  const amountLabel = document.createElement("label");
  amountLabel.append(document.createElement("span"));
  amountLabel.firstChild.textContent = "Amount";
  const amount = document.createElement("input");
  amount.type = "number";
  amount.step = "0.1";
  amount.min = "0";
  amount.className = "nutrient-amount-input";
  amountLabel.append(amount);

  const filler1 = document.createElement("div");
  const filler2 = document.createElement("div");
  const remove = removeButton(() => row.remove());
  row.append(selectLabel, amountLabel, filler1, filler2, remove);
  elements.nutrientRows.append(row);
  syncNutrientSelects();
}

function addIngredientRow() {
  const row = document.createElement("div");
  row.className = "dynamic-row ingredients-row";

  const searchLabel = document.createElement("label");
  searchLabel.append(document.createElement("span"));
  searchLabel.firstChild.textContent = "Search ingredient";
  const search = document.createElement("input");
  search.type = "search";
  search.placeholder = "banana, oats, milk...";
  search.className = "ingredient-search-input";
  searchLabel.append(search);

  const foodLabel = document.createElement("label");
  foodLabel.append(document.createElement("span"));
  foodLabel.firstChild.textContent = "Ingredient";
  const select = document.createElement("select");
  select.className = "ingredient-food-select";
  foodLabel.append(select);

  const weightLabel = document.createElement("label");
  weightLabel.append(document.createElement("span"));
  weightLabel.firstChild.textContent = "Weight (g)";
  const weight = document.createElement("input");
  weight.type = "number";
  weight.step = "0.1";
  weight.min = "0";
  weight.className = "ingredient-weight-input";
  weightLabel.append(weight);

  renderIngredientOptions(select, Object.values(state.foodCache));
  search.addEventListener("input", () => {
    const query = search.value.trim();
    window.clearTimeout(search._timer);
    search._timer = window.setTimeout(async () => {
      if (query.length < 2) {
        renderIngredientOptions(select, Object.values(state.foodCache));
        return;
      }

      try {
        const results = Object.values(await api.searchFoods(query));
        renderIngredientOptions(select, results);
      } catch (error) {
        showInlineError(elements.customFormError, error.message);
      }
    }, 250);
  });

  row.append(searchLabel, foodLabel, weightLabel, removeButton(() => row.remove()));
  elements.ingredientsList.append(row);
}

function addPortionRow() {
  const row = document.createElement("div");
  row.className = "dynamic-row";

  row.append(
    textField("Amount", "portion-amount-input", "number", { step: "0.1", min: "0", value: "1" }),
    textField("Name", "portion-name-input", "text"),
    textField("Weight (g)", "portion-weight-input", "number", { step: "0.1", min: "0" }),
    document.createElement("div"),
    removeButton(() => row.remove()),
  );

  elements.portionRows.append(row);
}

function textField(labelText, className, type, attributes = {}) {
  const label = document.createElement("label");
  const span = document.createElement("span");
  span.textContent = labelText;
  const input = document.createElement("input");
  input.className = className;
  input.type = type;
  Object.assign(input, attributes);
  label.append(span, input);
  return label;
}

function removeButton(onClick) {
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = "Remove";
  button.addEventListener("click", onClick);
  return button;
}

function syncNutrientSelects() {
  const options = Object.values(state.nutrients).sort((a, b) => a.name.localeCompare(b.name));
  for (const select of document.querySelectorAll(".nutrient-id-select")) {
    const current = select.value;
    select.textContent = "";
    for (const nutrient of options) {
      const option = document.createElement("option");
      option.value = nutrient.id;
      option.textContent = `${nutrient.name} (${nutrient.unit})`;
      select.append(option);
    }
    if (current) select.value = current;
  }
}

async function submitCustomFood(event) {
  event.preventDefault();
  const action = elements.customAction.value;

  try {
    const payload = buildCustomPayload(action);
    await api[action](payload);
    hideInlineError(elements.customFormError);
    elements.customFoodForm.reset();
    elements.customAction.value = action;
    elements.customName.value = "";
    elements.nutrientRows.textContent = "";
    elements.ingredientsList.textContent = "";
    elements.portionRows.textContent = "";
    if (action === "addRecipeFood" || action === "editRecipeFood") addIngredientRow();
    else addNutrientRow();
    addPortionRow();
    updateCustomFormMode();
  } catch (error) {
    showInlineError(elements.customFormError, error.message);
  }
}

function buildCustomPayload(action) {
  const isRecipe = action === "addRecipeFood" || action === "editRecipeFood";
  const isEdit = action === "editBrandedFood" || action === "editRecipeFood";

  const payload = {
    name: elements.customName.value.trim(),
  };

  if (!payload.name) {
    throw new Error("Name is required.");
  }

  if (isEdit) {
    const fdcId = Number(elements.customFdcId.value);
    if (!Number.isInteger(fdcId) || fdcId <= 0) {
      throw new Error("Food id is required for edit actions.");
    }
    payload.fdc_id = fdcId;
  }

  payload.portions = [...elements.portionRows.querySelectorAll(".dynamic-row")].map((row) => {
    const amount = Number(row.querySelector(".portion-amount-input").value);
    const name = row.querySelector(".portion-name-input").value.trim();
    const weight = Number(row.querySelector(".portion-weight-input").value);
    if (!Number.isFinite(amount) || amount <= 0 || !name || !Number.isFinite(weight) || weight <= 0) {
      throw new Error("Each portion needs amount, name, and positive weight.");
    }
    return { amount, name, weight };
  });

  if (!payload.portions.length) {
    throw new Error("At least one portion is required.");
  }

  if (isRecipe) {
    payload.ingredients = [...elements.ingredientsList.querySelectorAll(".dynamic-row")].map((row) => {
      const fdcId = Number(row.querySelector(".ingredient-food-select").value);
      const weight = Number(row.querySelector(".ingredient-weight-input").value);
      if (!Number.isInteger(fdcId) || fdcId <= 0 || !Number.isFinite(weight) || weight <= 0) {
        throw new Error("Each ingredient needs a selected food and positive weight.");
      }
      return { fdc_id: fdcId, weight };
    });

    if (!payload.ingredients.length) {
      throw new Error("At least one ingredient is required for recipe foods.");
    }
  } else {
    payload.nutrients = [...elements.nutrientRows.querySelectorAll(".dynamic-row")].map((row) => {
      const id = Number(row.querySelector(".nutrient-id-select").value);
      const amount = Number(row.querySelector(".nutrient-amount-input").value);
      if (!Number.isInteger(id) || !Number.isFinite(amount) || amount < 0) {
        throw new Error("Each nutrient row needs a nutrient and non-negative amount.");
      }
      return { id, amount };
    });

    if (!payload.nutrients.length) {
      throw new Error("At least one nutrient is required for branded foods.");
    }
  }

  return payload;
}

function setActiveView(id) {
  for (const view of elements.views) {
    view.classList.toggle("is-active", view.id === id);
  }

  for (const tab of elements.tabs) {
    tab.classList.toggle("is-active", tab.dataset.viewTarget === id);
  }
}

function showGlobalError(message) {
  state.globalError = message;
  elements.globalError.textContent = message;
  elements.globalError.classList.remove("hidden");
}

function clearGlobalError() {
  state.globalError = "";
  elements.globalError.textContent = "";
  elements.globalError.classList.add("hidden");
}

function showInlineError(node, message) {
  node.textContent = message;
  node.classList.remove("hidden");
}

function hideInlineError(node) {
  node.textContent = "";
  node.classList.add("hidden");
}

function nowLocalValue() {
  const now = new Date();
  const offset = now.getTimezoneOffset();
  const local = new Date(now.getTime() - offset * 60000);
  return local.toISOString().slice(0, 16);
}
