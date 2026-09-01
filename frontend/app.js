import { createApi } from "./api.js";
import { IMPORTANT_NUTRIENT_IDS } from "./config.js";
import { state, today } from "./state.js";
import { renderFoodDetails, renderResultList, renderSummary } from "./ui.js";

const api = createApi(() => state.apiBase);
let searchTimer = null;
let browserTimer = null;
let autoTimestampTimer = null;
let quantityMode = "grams";
let selectedPortionId = null;
let customAction = "addBrandedFood";

const elements = {
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
  mealTimestampAuto: document.querySelector("#meal-timestamp-auto"),
  mealTimestamp: document.querySelector("#meal-timestamp"),
  quantityMode: document.querySelector("#quantity-mode"),
  quantityModeButtons: [...document.querySelectorAll("#quantity-mode [data-mode-value]")],
  gramsFields: document.querySelector("#grams-fields"),
  portionFields: document.querySelector("#portion-fields"),
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
  customActionButtons: [...document.querySelectorAll("#custom-action [data-action-value]")],
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
  elements.summaryDate.value = state.summaryDate;
  syncTimestampMode();

  bindEvents();
  addPortionRow();
  updateCustomFormMode();
  await loadInitialData();
}

function bindEvents() {
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

  elements.mealTimestampAuto.addEventListener("change", syncTimestampMode);
  for (const button of elements.quantityModeButtons) {
    button.addEventListener("click", () => {
      if (button.disabled) return;
      quantityMode = button.dataset.modeValue;
      syncQuantityMode();
    });
  }
  elements.gramsInput.addEventListener("input", renderComputedWeight);
  elements.portionCount.addEventListener("input", renderComputedWeight);

  elements.logMealForm.addEventListener("submit", submitLogMeal);

  for (const button of elements.customActionButtons) {
    button.addEventListener("click", () => {
      customAction = button.dataset.actionValue;
      updateCustomActionButtons();
      updateCustomFormMode();
    });
  }
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
    seedBrandedNutrientsIfNeeded();
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
      syncQuantityMode();
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
  const portionButton = elements.quantityModeButtons.find((button) => button.dataset.modeValue === "portion");
  if (!portions.length) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = "No named portions";
    elements.portionSelect.append(empty);
    if (portionButton) portionButton.disabled = true;
    selectedPortionId = null;
    quantityMode = "grams";
    updateQuantityModeButtons();
    return;
  }

  if (portionButton) portionButton.disabled = false;

  for (const portion of portions) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "choice-chip";
    button.dataset.portionId = String(portion.id);
    button.dataset.weight = String(portion.weight);
    button.textContent = `${portion.amount} ${portion.unit || "portion"} = ${portion.weight} g`;
    button.addEventListener("click", () => {
      selectedPortionId = String(portion.id);
      updatePortionButtons();
      renderComputedWeight();
    });
    elements.portionSelect.append(button);
  }

  selectedPortionId = String(portions[0].id);
  updatePortionButtons();
}

function syncQuantityMode() {
  const hasPortions = !!state.selectedFood && Object.keys(state.selectedFood.portions || {}).length > 0;
  if (quantityMode === "portion" && !hasPortions) {
    quantityMode = "grams";
  }

  updateQuantityModeButtons();
  const isPortionMode = quantityMode === "portion" && hasPortions;
  elements.gramsFields.classList.toggle("hidden", isPortionMode);
  elements.portionFields.classList.toggle("hidden", !isPortionMode);
  renderComputedWeight();
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
  if (quantityMode === "grams") {
    const grams = Number(elements.gramsInput.value);
    return {
      weight: grams,
      message: Number.isFinite(grams) && grams > 0 ? `Computed weight: ${grams.toFixed(1)} g` : "Enter a positive gram value.",
    };
  }

  if (!state.selectedFood || !Object.keys(state.selectedFood.portions || {}).length) {
    return {
      weight: Number.NaN,
      message: "This food has no named portions; use grams.",
    };
  }

  const selected = elements.portionSelect.querySelector(`[data-portion-id="${selectedPortionId}"]`);
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

  const timestamp = elements.mealTimestampAuto.checked ? nowLocalValue() : elements.mealTimestamp.value;
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
    syncTimestampMode();
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
  const action = customAction;
  const isRecipe = action === "addRecipeFood" || action === "editRecipeFood";
  const isEdit = action === "editBrandedFood" || action === "editRecipeFood";

  elements.recipeIngredientsBlock.classList.toggle("hidden", !isRecipe);
  elements.nutrientsBlock.classList.toggle("hidden", isRecipe);
  elements.customFdcWrap.classList.toggle("hidden", !isEdit);

  if (isRecipe && !elements.ingredientsList.children.length) addIngredientRow();
  if (!isRecipe && !elements.nutrientRows.children.length) seedBrandedNutrientsIfNeeded();
}

function addNutrientRow(preferredId = null) {
  const row = document.createElement("div");
  row.className = "dynamic-row";

  const selectLabel = document.createElement("label");
  selectLabel.append(document.createElement("span"));
  selectLabel.firstChild.textContent = "Nutrient";
  const select = document.createElement("select");
  select.className = "nutrient-id-select";
  if (preferredId !== null) select.dataset.preferredId = String(preferredId);
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
  row.dataset.selectedFdcId = "";

  const searchLabel = document.createElement("label");
  searchLabel.className = "ingredient-picker";
  searchLabel.append(document.createElement("span"));
  searchLabel.firstChild.textContent = "Ingredient";
  const search = document.createElement("input");
  search.type = "search";
  search.placeholder = "banana, oats, milk...";
  search.className = "ingredient-search-input";
  searchLabel.append(search);
  const results = document.createElement("div");
  results.className = "ingredient-picker-results hidden";
  searchLabel.append(results);

  const weightLabel = document.createElement("label");
  weightLabel.append(document.createElement("span"));
  weightLabel.firstChild.textContent = "Weight (g)";
  const weight = document.createElement("input");
  weight.type = "number";
  weight.step = "0.1";
  weight.min = "0";
  weight.className = "ingredient-weight-input";
  weightLabel.append(weight);

  const modeLabel = document.createElement("div");
  modeLabel.className = "choice-group-block";
  const modeTitle = document.createElement("span");
  modeTitle.textContent = "Mode";
  const mode = document.createElement("div");
  mode.className = "choice-group ingredient-mode-group";
  const gramsButton = document.createElement("button");
  gramsButton.type = "button";
  gramsButton.className = "choice-chip is-active";
  gramsButton.dataset.modeValue = "grams";
  gramsButton.textContent = "Grams";
  const portionButton = document.createElement("button");
  portionButton.type = "button";
  portionButton.className = "choice-chip";
  portionButton.dataset.modeValue = "portion";
  portionButton.textContent = "Portion";
  mode.append(gramsButton, portionButton);
  modeLabel.append(modeTitle, mode);

  const portionWrap = document.createElement("div");
  portionWrap.className = "stack-md hidden ingredient-portion-wrap";
  const portionLabel = document.createElement("div");
  portionLabel.className = "choice-group-block";
  const portionTitle = document.createElement("span");
  portionTitle.textContent = "Portion";
  const portionSelect = document.createElement("div");
  portionSelect.className = "choice-group choice-group-wrap ingredient-portion-select";
  portionLabel.append(portionTitle, portionSelect);

  const countLabel = document.createElement("label");
  countLabel.append(document.createElement("span"));
  countLabel.firstChild.textContent = "Count";
  const count = document.createElement("input");
  count.type = "number";
  count.min = "0";
  count.step = "0.1";
  count.value = "1";
  count.className = "ingredient-count-input";
  countLabel.append(count);
  portionWrap.append(portionLabel, countLabel);

  search.addEventListener("input", () => {
    const query = search.value.trim();
    row.dataset.selectedFdcId = "";
    window.clearTimeout(search._timer);
    search._timer = window.setTimeout(async () => {
      if (query.length < 2) {
        results.textContent = "";
        results.classList.add("hidden");
        return;
      }

      try {
        const matches = Object.values(await api.searchFoods(query));
        renderIngredientPickerResults(row, matches);
      } catch (error) {
        showInlineError(elements.customFormError, error.message);
      }
    }, 250);
  });

  gramsButton.addEventListener("click", () => {
    row.dataset.ingredientMode = "grams";
    syncIngredientMode(row);
  });
  portionButton.addEventListener("click", () => {
    if (portionButton.disabled) return;
    row.dataset.ingredientMode = "portion";
    syncIngredientMode(row);
  });

  row.append(searchLabel, modeLabel, weightLabel, removeButton(() => row.remove()), portionWrap);
  elements.ingredientsList.append(row);
}

function addPortionRow() {
  const row = document.createElement("div");
  row.className = "dynamic-row";

  row.append(
    textField("Amount", "portion-amount-input", "number", { step: "0.1", min: "0", value: "1" }),
    textField("Unit", "portion-unit-input", "text"),
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
    const current = select.value || select.dataset.preferredId || "";
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

function seedBrandedNutrientsIfNeeded() {
  if (customAction === "addRecipeFood" || customAction === "editRecipeFood") return;
  if (elements.nutrientRows.children.length) return;
  for (const id of IMPORTANT_NUTRIENT_IDS) {
    addNutrientRow(id);
  }
}

async function submitCustomFood(event) {
  event.preventDefault();
  const action = customAction;

  try {
    const payload = buildCustomPayload(action);
    await api[action](payload);
    hideInlineError(elements.customFormError);
    elements.customFoodForm.reset();
    elements.customName.value = "";
    elements.nutrientRows.textContent = "";
    elements.ingredientsList.textContent = "";
    elements.portionRows.textContent = "";
    if (action === "addRecipeFood" || action === "editRecipeFood") addIngredientRow();
    else seedBrandedNutrientsIfNeeded();
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
    const unit = row.querySelector(".portion-unit-input").value.trim();
    const weight = Number(row.querySelector(".portion-weight-input").value);
    if (!Number.isFinite(amount) || amount <= 0 || !unit || !Number.isFinite(weight) || weight <= 0) {
      throw new Error("Each portion needs amount, unit, and positive weight.");
    }
    return { amount, unit, weight };
  });

  if (!payload.portions.length) {
    throw new Error("At least one portion is required.");
  }

  if (isRecipe) {
    payload.ingredients = [...elements.ingredientsList.querySelectorAll(".dynamic-row")].map((row) => {
      const fdcId = Number(row.dataset.selectedFdcId);
      const mode = row.dataset.ingredientMode || "grams";
      let weight;
      if (mode === "portion") {
        const selected = row.querySelector(".ingredient-portion-select .choice-chip.is-active");
        const portionWeight = Number(selected?.dataset.weight);
        const count = Number(row.querySelector(".ingredient-count-input").value);
        weight = portionWeight * count;
      } else {
        weight = Number(row.querySelector(".ingredient-weight-input").value);
      }
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

async function getFoodDetailsCached(fdcId) {
  if (state.foodCache[fdcId]?.portions) return state.foodCache[fdcId];
  const food = await api.getFood(fdcId);
  state.foodCache[fdcId] = food;
  return food;
}

async function syncIngredientPortions(row) {
  const portionSelect = row.querySelector(".ingredient-portion-select");
  const portionButton = row.querySelector('[data-mode-value="portion"]');
  const fdcId = Number(row.dataset.selectedFdcId);

  portionSelect.textContent = "";
  if (!Number.isInteger(fdcId) || fdcId <= 0) {
    row.dataset.ingredientMode = "grams";
    syncIngredientMode(row);
    return;
  }

  try {
    const food = await getFoodDetailsCached(fdcId);
    const portions = Object.values(food.portions || {});

    if (!portions.length) {
      const empty = document.createElement("div");
      empty.className = "empty-state";
      empty.textContent = "No named portions";
      portionSelect.append(empty);
      if (portionButton) portionButton.disabled = true;
      row.dataset.ingredientMode = "grams";
    } else {
      if (portionButton) portionButton.disabled = false;
      for (const portion of portions) {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "choice-chip";
        button.dataset.portionId = String(portion.id);
        button.dataset.weight = String(portion.weight);
        button.textContent = `${portion.amount} ${portion.unit || "portion"} = ${portion.weight} g`;
        button.addEventListener("click", () => {
          for (const chip of portionSelect.querySelectorAll(".choice-chip")) chip.classList.remove("is-active");
          button.classList.add("is-active");
        });
        portionSelect.append(button);
      }
      portionSelect.querySelector(".choice-chip")?.classList.add("is-active");
    }

    syncIngredientMode(row);
  } catch (error) {
    showInlineError(elements.customFormError, error.message);
  }
}

function syncIngredientMode(row) {
  const weightLabel = row.querySelector(".ingredient-weight-input").closest("label");
  const portionWrap = row.querySelector(".ingredient-portion-wrap");
  const portionSelect = row.querySelector(".ingredient-portion-select");
  const mode = row.dataset.ingredientMode || "grams";
  const hasPortions = !!portionSelect.querySelector(".choice-chip");
  if (mode === "portion" && !hasPortions) row.dataset.ingredientMode = "grams";
  const activeMode = row.dataset.ingredientMode || "grams";
  const isPortion = activeMode === "portion";
  for (const button of row.querySelectorAll(".ingredient-mode-group .choice-chip")) {
    button.classList.toggle("is-active", button.dataset.modeValue === activeMode);
  }
  weightLabel.classList.toggle("hidden", isPortion);
  portionWrap.classList.toggle("hidden", !isPortion);
}

function updateQuantityModeButtons() {
  for (const button of elements.quantityModeButtons) {
    button.classList.toggle("is-active", button.dataset.modeValue === quantityMode);
  }
}

function updatePortionButtons() {
  for (const button of elements.portionSelect.querySelectorAll(".choice-chip")) {
    button.classList.toggle("is-active", button.dataset.portionId === selectedPortionId);
  }
}

function updateCustomActionButtons() {
  for (const button of elements.customActionButtons) {
    button.classList.toggle("is-active", button.dataset.actionValue === customAction);
  }
}

function renderIngredientPickerResults(row, matches) {
  const results = row.querySelector(".ingredient-picker-results");
  const search = row.querySelector(".ingredient-search-input");
  results.textContent = "";
  if (!matches.length) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = "No matching foods.";
    results.append(empty);
    results.classList.remove("hidden");
    return;
  }

  for (const item of matches) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "result-item";
    const title = document.createElement("strong");
    title.textContent = item.description;
    const meta = document.createElement("small");
    meta.textContent = `${item.dataType} · #${item.fdcId}`;
    button.append(title, meta);
    button.addEventListener("click", () => {
      row.dataset.selectedFdcId = String(item.fdcId);
      search.value = item.description;
      results.classList.add("hidden");
      results.textContent = "";
      void syncIngredientPortions(row);
    });
    results.append(button);
  }

  results.classList.remove("hidden");
}

function syncTimestampMode() {
  const isAuto = elements.mealTimestampAuto.checked;
  elements.mealTimestamp.disabled = isAuto;
  if (autoTimestampTimer) {
    window.clearInterval(autoTimestampTimer);
    autoTimestampTimer = null;
  }

  if (isAuto) {
    elements.mealTimestamp.value = nowLocalValue();
    autoTimestampTimer = window.setInterval(() => {
      elements.mealTimestamp.value = nowLocalValue();
    }, 1000);
  }
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
