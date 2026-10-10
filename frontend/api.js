function joinPath(base, path) {
  return `${base.replace(/\/$/, "")}/${path.replace(/^\//, "")}`;
}

async function request(base, path, options = {}) {
  const response = await fetch(joinPath(base, path), {
    headers: {
      Accept: "application/json",
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(options.headers || {}),
    },
    ...options,
  });

  const contentType = response.headers.get("content-type") || "";
  if (!response.ok) {
    const message = await response.text();
    const error = new Error(message || `Request failed with status ${response.status}`);
    error.status = response.status;
    throw error;
  }

  if (!contentType.includes("application/json")) {
    return null;
  }

  return response.json();
}

export function createApi(getBase) {
  return {
    getNutrients() {
      return request(getBase(), "/nutrients");
    },
    searchFoods(pattern) {
      return request(getBase(), `/foods/${encodeURIComponent(pattern)}`);
    },
    getFood(fdcId) {
      return request(getBase(), `/food/${fdcId}`);
    },
    getSummary(dateValue) {
      return request(getBase(), `/summary/${encodeURIComponent(dateValue)}`);
    },
    logMeal(payload) {
      return request(getBase(), "/logMeal", {
        method: "POST",
        body: JSON.stringify(payload),
      });
    },
    deleteMeal(mealId) {
      return request(getBase(), "/deleteMeal", {
        method: "POST",
        body: JSON.stringify({ meal_id: mealId }),
      });
    },
    getStored() {
      return request(getBase(), "/stored");
    },
    addStored(payload) {
      return request(getBase(), "/stored", {
        method: "POST",
        body: JSON.stringify(payload),
      });
    },
    updateStored(payload) {
      return request(getBase(), "/stored", {
        method: "PUT",
        body: JSON.stringify(payload),
      });
    },
    deleteStored(id) {
      return request(getBase(), "/stored", {
        method: "DELETE",
        body: JSON.stringify({ id }),
      });
    },
    addBrandedFood(payload) {
      return request(getBase(), "/addBrandedFood", {
        method: "POST",
        body: JSON.stringify(payload),
      });
    },
    addRecipeFood(payload) {
      return request(getBase(), "/addRecipeFood", {
        method: "POST",
        body: JSON.stringify(payload),
      });
    },
    editBrandedFood(payload) {
      return request(getBase(), "/editBrandedFood", {
        method: "POST",
        body: JSON.stringify(payload),
      });
    },
    editRecipeFood(payload) {
      return request(getBase(), "/editRecipeFood", {
        method: "POST",
        body: JSON.stringify(payload),
      });
    },
  };
}
