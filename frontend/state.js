import { API_BASE } from "./config.js";

export const state = {
  apiBase: API_BASE,
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
