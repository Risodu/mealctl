const savedBase = localStorage.getItem("mealctl.apiBase") || "http://localhost:8000";

export const state = {
  apiBase: savedBase,
  nutrients: {},
  summaryDate: today(),
  summary: [],
  summaryStatus: "",
  foodSearchStatus: "Type at least 2 letters to search.",
  foodsBrowserStatus: "Type at least 2 letters to search.",
  foodSearchResults: [],
  foodsBrowserResults: [],
  selectedFood: null,
  selectedFoodSource: "log",
  foodCache: {},
  pending: {
    summary: false,
    search: false,
    browse: false,
    food: false,
    logMeal: false,
    customFood: false,
  },
  globalError: "",
};

export function today() {
  return new Date().toISOString().slice(0, 10);
}

export function setApiBase(value) {
  state.apiBase = value || "/api/meal";
  localStorage.setItem("mealctl.apiBase", state.apiBase);
}
