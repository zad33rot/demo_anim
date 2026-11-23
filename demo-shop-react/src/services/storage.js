const isStorageAvailable =
  typeof window !== "undefined" && typeof window.localStorage !== "undefined";

export function loadFromStorage(key, fallbackValue) {
  if (!isStorageAvailable) {
    return fallbackValue;
  }
  try {
    const raw = window.localStorage.getItem(key);
    if (raw === null) {
      return fallbackValue;
    }
    return JSON.parse(raw);
  } catch (error) {
    console.warn("Не удалось прочитать localStorage:", error);
    return fallbackValue;
  }
}

export function saveToStorage(key, value) {
  if (!isStorageAvailable) {
    return;
  }
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.warn("Не удалось сохранить в localStorage:", error);
  }
}

export function removeFromStorage(key) {
  if (!isStorageAvailable) {
    return;
  }
  window.localStorage.removeItem(key);
}