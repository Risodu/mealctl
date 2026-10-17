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
  storedEntries: [],
  selectedFood: null,
  selectedFoodSource: "log",
  foodCache: {},
  pending: {
    summary: false,
    search: false,
    browse: false,
    food: false,
    logMeal: false,
    storage: false,
    storageMutation: false,
    customFood: false,
  },
  globalError: "",
};

export function today() {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}
